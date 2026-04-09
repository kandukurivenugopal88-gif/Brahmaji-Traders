import cors from "cors";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import path from "path";
import Razorpay from "razorpay";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = process.env.PORT || 5000;

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const ownerNotificationEmail = process.env.OWNER_NOTIFICATION_EMAIL;
const mongoUri = process.env.MONGODB_URI;

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const smsProvider = String(process.env.SMS_PROVIDER || "twilio").trim().toLowerCase();
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromPhone = process.env.TWILIO_FROM_PHONE;
const fast2SmsApiKey = process.env.FAST2SMS_API_KEY;
const fast2SmsRoute = process.env.FAST2SMS_ROUTE || "q";
const textbeltApiKey = process.env.TEXTBELT_API_KEY || "textbelt";
const smsSimulationEnabled = String(process.env.SMS_SIMULATION_ENABLED || "true").toLowerCase() === "true";

const allowedOrigins = String(
	process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function isAllowedOrigin(origin) {
	if (!origin) {
		return true;
	}

	if (allowedOrigins.includes(origin)) {
		return true;
	}

	return localDevOriginPattern.test(origin);
}

const globalRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 1200,
	standardHeaders: true,
	legacyHeaders: false,
});

const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 200,
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, message: "Too many auth requests. Please retry later." },
});

const paymentRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 300,
	standardHeaders: true,
	legacyHeaders: false,
	message: { success: false, message: "Too many payment requests. Please retry later." },
});

app.disable("x-powered-by");
app.use(
	helmet({
		crossOriginResourcePolicy: false,
	})
);
app.use(
	cors({
		origin(origin, callback) {
			if (isAllowedOrigin(origin)) {
				callback(null, true);
				return;
			}

			callback(new Error("Origin not allowed by CORS"));
		},
	})
);
app.use(express.json({ limit: "100kb" }));
app.use(globalRateLimiter);
app.use("/api/account", authRateLimiter);
app.use("/api/payment", paymentRateLimiter);

app.get("/", (req, res) => {
	res.json({
		ok: true,
		message: "Brahmaji Traders backend is running.",
		hint: "Use /api/health, /api/orders, /api/payment/* endpoints.",
	});
});

const mailTransporter =
	smtpHost && smtpUser && smtpPass
		? nodemailer.createTransport({
				host: smtpHost,
				port: smtpPort,
				secure: smtpPort === 465,
				auth: {
					user: smtpUser,
					pass: smtpPass,
				},
			})
		: null;

const razorpay =
	razorpayKeyId && razorpayKeySecret
		? new Razorpay({
				key_id: razorpayKeyId,
				key_secret: razorpayKeySecret,
			})
		: null;

const orderHistory = [];
const ratingHistory = [];
const accountHistory = [];
const chatIssueHistory = [];
const productStockMeta = {};
const passwordResetOtpStore = new Map();
let isMongoConnected = false;
let storageMode = "memory";
const localStorageFilePath = path.join(__dirname, "data", "storage.json");
const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_INTERVAL_MS = 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const MARKET_SYMBOLS = [
	{ id: "gold", symbol: "gc.f", name: "Gold", category: "Metals", unit: "oz" },
	{ id: "silver", symbol: "si.f", name: "Silver", category: "Metals", unit: "oz" },
	{ id: "crude-oil", symbol: "cl.f", name: "Crude Oil", category: "Energy", unit: "barrel" },
	{ id: "brent", symbol: "brn.f", name: "Brent Oil", category: "Energy", unit: "barrel" },
	{ id: "natural-gas", symbol: "ng.f", name: "Natural Gas", category: "Energy", unit: "MMBtu" },
	{ id: "corn", symbol: "zc.f", name: "Corn", category: "Agriculture", unit: "bushel" },
	{ id: "wheat", symbol: "zw.f", name: "Wheat", category: "Agriculture", unit: "bushel" },
	{ id: "soybean", symbol: "zs.f", name: "Soybean", category: "Agriculture", unit: "bushel" },
];

function normalizeEmail(email) {
	return String(email || "").trim().toLowerCase();
}

function escapeRegex(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createOtpCode() {
	return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(code) {
	return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function clearExpiredPasswordOtps() {
	const now = Date.now();
	for (const [email, otpRecord] of passwordResetOtpStore.entries()) {
		if (!otpRecord?.expiresAt || otpRecord.expiresAt <= now) {
			passwordResetOtpStore.delete(email);
		}
	}
}

function parseCsvRows(csvText) {
	const text = String(csvText || "").trim();
	if (!text) {
		return [];
	}

	const lines = text.split(/\r?\n/).filter(Boolean);
	if (lines.length < 2) {
		return [];
	}

	const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
	return lines.slice(1).map((line) => {
		const values = line.split(",");
		const row = {};
		headers.forEach((header, index) => {
			row[header] = String(values[index] ?? "").trim();
		});
		return row;
	});
}

async function fetchLiveMarketQuotes() {
	const symbolList = MARKET_SYMBOLS.map((item) => item.symbol).join(",");
	const stooqUrl = `https://stooq.com/q/l/?s=${encodeURIComponent(symbolList)}&f=sd2t2ohlcvn&e=csv`;
	const response = await fetch(stooqUrl, {
		headers: {
			"User-Agent": "BrahmajiTraders/1.0",
		},
	});

	if (!response.ok) {
		throw new Error(`Market API returned ${response.status}`);
	}

	const csvText = await response.text();
	const rows = parseCsvRows(csvText);
	const rowsBySymbol = new Map(
		rows.map((row) => [String(row.symbol || "").toLowerCase(), row])
	);

	const items = MARKET_SYMBOLS.map((meta) => {
		const row = rowsBySymbol.get(String(meta.symbol).toLowerCase()) || {};
		const closePrice = Number(row.close);
		const openPrice = Number(row.open);
		const safeLive = Number.isFinite(closePrice) && closePrice > 0 ? closePrice : 0;
		const safeBase = Number.isFinite(openPrice) && openPrice > 0 ? openPrice : safeLive;
		const delta = safeLive - safeBase;

		return {
			id: meta.id,
			symbol: meta.symbol,
			name: meta.name,
			category: meta.category,
			unit: meta.unit,
			basePrice: Number(safeBase.toFixed(4)),
			livePrice: Number(safeLive.toFixed(4)),
			delta: Number(delta.toFixed(4)),
			direction: delta > 0.0001 ? "up" : delta < -0.0001 ? "down" : "flat",
			updatedAt: row.date && row.time ? `${row.date} ${row.time}` : new Date().toISOString(),
			exchangeName: row.name || "Stooq",
		};
	});

	return {
		source: "stooq",
		updatedAt: new Date().toISOString(),
		items,
	};
}

async function loadLocalPersistentState() {
	try {
		const raw = await fs.readFile(localStorageFilePath, "utf8");
		const parsed = JSON.parse(raw);

		if (Array.isArray(parsed?.orders)) {
			orderHistory.splice(0, orderHistory.length, ...parsed.orders);
		}

		if (Array.isArray(parsed?.ratings)) {
			ratingHistory.splice(0, ratingHistory.length, ...parsed.ratings);
		}

		if (Array.isArray(parsed?.accounts)) {
			accountHistory.splice(0, accountHistory.length, ...parsed.accounts);
		}

		if (Array.isArray(parsed?.chatIssues)) {
			chatIssueHistory.splice(0, chatIssueHistory.length, ...parsed.chatIssues);
		}

		if (parsed?.productStockMeta && typeof parsed.productStockMeta === "object") {
			for (const [key, value] of Object.entries(parsed.productStockMeta)) {
				productStockMeta[String(key)] = value;
			}
		}
	} catch {
		// Ignore first-run or malformed file issues and continue with empty fallback arrays.
	}
}

async function persistLocalState() {
	if (isMongoConnected) {
		return;
	}

	try {
		await fs.mkdir(path.dirname(localStorageFilePath), { recursive: true });
		await fs.writeFile(
			localStorageFilePath,
			JSON.stringify(
				{
					orders: orderHistory,
					ratings: ratingHistory,
					accounts: accountHistory,
					chatIssues: chatIssueHistory,
					productStockMeta,
				},
				null,
				2
			),
			"utf8"
		);
	} catch (error) {
		console.log("Failed to persist local storage fallback:", error.message);
	}
}

const orderItemSchema = new mongoose.Schema(
	{
		name: { type: String, default: "" },
		qty: { type: Number, default: 1 },
		price: { type: Number, default: 0 },
	},
	{ _id: false }
);

const orderSchema = new mongoose.Schema(
	{
		method: { type: String, enum: ["online", "cod"], required: true },
		status: {
			type: String,
			enum: ["new", "accepted", "packed", "shipped", "delivered", "rejected", "cancelled"],
			default: "new",
		},
		amount: { type: Number, required: true },
		currency: { type: String, default: "INR" },
		items: { type: [orderItemSchema], default: [] },
		paymentId: { type: String, default: null },
		orderId: { type: String, default: null },
		customerName: { type: String, default: null },
		customerEmail: { type: String, default: null },
		customerPhone: { type: String, default: null },
		customerAddress: { type: String, default: null },
		cancelReason: { type: String, default: "" },
		cancelledAt: { type: Date, default: null },
		cancelledBy: { type: String, default: null },
		deliveredAt: { type: Date, default: null },
		returnRequested: { type: Boolean, default: false },
		returnReason: { type: String, default: "" },
		returnRequestedAt: { type: Date, default: null },
		returnWindowEndsAt: { type: Date, default: null },
		returnStatus: {
			type: String,
			enum: ["none", "requested", "approved", "rejected", "completed"],
			default: "none",
		},
		returnedAt: { type: Date, default: null },
		notified: { type: Boolean, default: false },
		notifyMessage: { type: String, default: "" },
	},
	{ timestamps: true }
);

const OrderModel = mongoose.models.Order || mongoose.model("Order", orderSchema);

const productRatingSchema = new mongoose.Schema(
	{
		productId: { type: String, default: "" },
		productName: { type: String, required: true },
		price: { type: Number, default: 0 },
		rating: { type: Number, required: true, min: 1, max: 5 },
		customerEmail: { type: String, required: true },
		message: { type: String, default: "" },
	},
	{ timestamps: true }
);

const ProductRatingModel =
	mongoose.models.ProductRating || mongoose.model("ProductRating", productRatingSchema);

const customerAccountSchema = new mongoose.Schema(
	{
		name: { type: String, default: "" },
		email: { type: String, required: true },
		passwordHash: { type: String, required: true },
	},
	{ timestamps: true }
);

const CustomerAccountModel =
	mongoose.models.CustomerAccount || mongoose.model("CustomerAccount", customerAccountSchema);

const chatIssueSchema = new mongoose.Schema(
	{
		customerEmail: { type: String, required: true },
		issueText: { type: String, required: true },
		botReply: { type: String, default: "" },
	},
	{ timestamps: true }
);

const ChatIssueModel =
	mongoose.models.ChatIssue || mongoose.model("ChatIssue", chatIssueSchema);

async function connectMongo() {
	const dbName = process.env.MONGODB_DB_NAME || "brahmaji_traders";

	if (mongoUri) {
		try {
			await mongoose.connect(mongoUri, { dbName });
			isMongoConnected = true;
			storageMode = "mongodb";
			console.log("MongoDB connected for persistent order storage.");
			return;
		} catch (error) {
			console.log("MongoDB URI connection failed:", error.message);
		}
	}

	isMongoConnected = false;
	storageMode = "file-memory";
	await loadLocalPersistentState();
	console.log("Using local persistent file fallback storage at backend/data/storage.json");
}

function formatOrderItems(items = []) {
	if (!Array.isArray(items) || items.length === 0) {
		return "No items provided";
	}

	return items
		.map((item, index) => {
			const name = item?.name || `Item ${index + 1}`;
			const qty = Number(item?.qty || 1);
			const price = Number(item?.price || 0);
			return `${index + 1}. ${name} x ${qty} = INR ${price * qty}`;
		})
		.join("\n");
}

async function sendOwnerOrderNotification(orderPayload) {
	const missingVars = [];
	if (!ownerNotificationEmail) missingVars.push("OWNER_NOTIFICATION_EMAIL");
	if (!smtpHost) missingVars.push("SMTP_HOST");
	if (!smtpPass) missingVars.push("SMTP_PASS");
	if (!smtpFrom) missingVars.push("SMTP_FROM/SMTP_USER");

	if (!mailTransporter || missingVars.length > 0) {
		return {
			notified: false,
			message: `Notification email is not configured. Missing: ${missingVars.join(", ") || "SMTP credentials"}.`,
		};
	}

	const {
		method,
		amount,
		currency,
		items,
		paymentId,
		orderId,
		customerName,
		customerPhone,
		customerAddress,
	} = orderPayload;

	const paymentMethod = method === "cod" ? "Cash on Delivery" : "Online Payment";
	const subject = `New Order Received - ${paymentMethod}`;
	const text = [
		"New order placed on Brahmaji Traders.",
		"",
		`Payment Method: ${paymentMethod}`,
		`Amount: ${currency || "INR"} ${amount}`,
		`Order ID: ${orderId || "N/A"}`,
		`Payment ID: ${paymentId || "N/A"}`,
		`Customer Name: ${customerName || "N/A"}`,
		`Customer Phone: ${customerPhone || "N/A"}`,
		`Customer Address: ${customerAddress || "N/A"}`,
		"",
		"Items:",
		formatOrderItems(items),
		"",
		`Placed At: ${new Date().toLocaleString("en-IN")}`,
	].join("\n");

	try {
		await mailTransporter.sendMail({
			from: smtpFrom,
			to: ownerNotificationEmail,
			subject,
			text,
		});

		return {
			notified: true,
			message: "Order notification sent successfully.",
		};
	} catch (error) {
		return {
			notified: false,
			message: `Email send failed: ${error.message || "Unknown SMTP error"}`,
		};
	}
}

async function sendNewAccountNotification({ name, email }) {
	const missingVars = [];
	if (!ownerNotificationEmail) missingVars.push("OWNER_NOTIFICATION_EMAIL");
	if (!smtpHost) missingVars.push("SMTP_HOST");
	if (!smtpPass) missingVars.push("SMTP_PASS");
	if (!smtpFrom) missingVars.push("SMTP_FROM/SMTP_USER");

	if (!mailTransporter || missingVars.length > 0) {
		return {
			notified: false,
			message: `Notification email is not configured. Missing: ${missingVars.join(", ") || "SMTP credentials"}.`,
		};
	}

	const subject = "New Customer Account Created";
	const text = [
		"A new customer account was created on Brahmaji Traders.",
		"",
		`Name: ${name || "N/A"}`,
		`Email: ${email || "N/A"}`,
		"Password: [PROTECTED]",
		"",
		`Created At: ${new Date().toLocaleString("en-IN")}`,
	].join("\n");

	try {
		await mailTransporter.sendMail({
			from: smtpFrom,
			to: ownerNotificationEmail,
			subject,
			text,
		});

		return {
			notified: true,
			message: "Account notification sent successfully.",
		};
	} catch (error) {
		return {
			notified: false,
			message: `Email send failed: ${error.message || "Unknown SMTP error"}`,
		};
	}
}

async function sendProductRatingNotification({
	productId,
	productName,
	price,
	rating,
	customerEmail,
	message,
}) {
	const missingVars = [];
	if (!ownerNotificationEmail) missingVars.push("OWNER_NOTIFICATION_EMAIL");
	if (!smtpHost) missingVars.push("SMTP_HOST");
	if (!smtpPass) missingVars.push("SMTP_PASS");
	if (!smtpFrom) missingVars.push("SMTP_FROM/SMTP_USER");

	if (!mailTransporter || missingVars.length > 0) {
		return {
			notified: false,
			message: `Notification email is not configured. Missing: ${missingVars.join(", ") || "SMTP credentials"}.`,
		};
	}

	const subject = "Customer Product Rating Received";
	const text = [
		"A customer submitted a product rating on Brahmaji Traders.",
		"",
		`Product ID: ${productId || "N/A"}`,
		`Product Name: ${productName || "N/A"}`,
		`Rate: INR ${price || "N/A"}`,
		`Rating: ${rating || 0} / 5`,
		`Customer Email: ${customerEmail || "N/A"}`,
		`Message: ${message || "(no message)"}`,
		"",
		`Submitted At: ${new Date().toLocaleString("en-IN")}`,
	].join("\n");

	try {
		await mailTransporter.sendMail({
			from: smtpFrom,
			to: ownerNotificationEmail,
			subject,
			text,
		});

		return {
			notified: true,
			message: "Product rating notification sent successfully.",
		};
	} catch (error) {
		return {
			notified: false,
			message: `Email send failed: ${error.message || "Unknown SMTP error"}`,
		};
	}
}

async function sendPasswordResetOtpNotification({ email, otp }) {
	const missingVars = [];
	if (!smtpHost) missingVars.push("SMTP_HOST");
	if (!smtpPass) missingVars.push("SMTP_PASS");
	if (!smtpFrom) missingVars.push("SMTP_FROM/SMTP_USER");

	if (!mailTransporter || missingVars.length > 0) {
		return {
			sent: false,
			message: `Password reset email is not configured. Missing: ${missingVars.join(", ") || "SMTP credentials"}.`,
		};
	}

	const subject = "Brahmaji Traders Password Reset OTP";
	const text = [
		"You requested to reset your Brahmaji Traders account password.",
		"",
		`OTP: ${otp}`,
		`This OTP is valid for ${Math.floor(PASSWORD_RESET_OTP_TTL_MS / 60000)} minutes.`,
		"Do not share this OTP with anyone.",
	].join("\n");

	try {
		await mailTransporter.sendMail({
			from: smtpFrom,
			to: email,
			subject,
			text,
		});

		return {
			sent: true,
			message: "OTP sent to your email.",
		};
	} catch (error) {
		return {
			sent: false,
			message: `OTP email failed: ${error.message || "Unknown SMTP error"}`,
		};
	}
}

function formatOrderStatusLabel(status) {
	const statusMap = {
		new: "New",
		accepted: "Accepted",
		packed: "Packed",
		shipped: "Shipped",
		delivered: "Delivered",
		rejected: "Rejected",
		cancelled: "Cancelled",
	};

	return statusMap[status] || String(status || "new");
}

function normalizePhoneForSms(phone) {
	const digits = String(phone || "").replace(/\D/g, "");
	if (!digits) {
		return "";
	}

	if (digits.length === 10) {
		return `+91${digits}`;
	}

	if (digits.length === 12 && digits.startsWith("91")) {
		return `+${digits}`;
	}

	if (String(phone).trim().startsWith("+")) {
		return String(phone).trim();
	}

	return `+${digits}`;
}

async function sendCustomerOrderStatusNotification(order, status) {
	const cleanEmail = normalizeEmail(order?.customerEmail);
	const cleanPhone = normalizePhoneForSms(order?.customerPhone);
	const statusLabel = formatOrderStatusLabel(status);
	const orderIdentifier = order?.orderId || order?.id || "N/A";
	const amountLine = `${order?.currency || "INR"} ${order?.amount || 0}`;
	const itemsLine = formatOrderItems(Array.isArray(order?.items) ? order.items : []);
	const orderTimeLine = order?.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "N/A";

	const result = {
		emailSent: false,
		smsSent: false,
		smsMode: "failed",
		emailMessage: "",
		smsMessage: "",
	};

	const smsText = `Brahmaji Traders: Order ${orderIdentifier} is ${statusLabel}. Amount ${amountLine}. Items: ${itemsLine}`;

	const sendViaTwilio = async () => {
		const twilioModule = await import("twilio");
		const twilioClient = twilioModule.default(twilioAccountSid, twilioAuthToken);
		await twilioClient.messages.create({
			from: twilioFromPhone,
			to: cleanPhone,
			body: smsText,
		});
	};

	const sendViaFast2Sms = async () => {
		const numbers = cleanPhone.replace(/^\+91/, "").replace(/^\+/, "");
		const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
			method: "POST",
			headers: {
				authorization: String(fast2SmsApiKey || "").trim(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				route: fast2SmsRoute,
				message: smsText,
				language: "english",
				numbers,
			}),
		});

		let data = null;
		try {
			data = await response.json();
		} catch {
			data = null;
		}

		if (!response.ok || data?.return === false) {
			throw new Error(data?.message || "Fast2SMS request failed.");
		}
	};

	const sendViaTextbelt = async () => {
		const body = new URLSearchParams({
			phone: cleanPhone,
			message: smsText,
			key: String(textbeltApiKey || "textbelt"),
		});

		const response = await fetch("https://textbelt.com/text", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		});

		let data = null;
		try {
			data = await response.json();
		} catch {
			data = null;
		}

		if (!response.ok || !data?.success) {
			throw new Error(data?.error || "Textbelt request failed.");
		}
	};

	const tryProviders = [];
	if (smsProvider === "fast2sms") {
		tryProviders.push("fast2sms", "twilio", "textbelt");
	} else if (smsProvider === "textbelt") {
		tryProviders.push("textbelt", "twilio", "fast2sms");
	} else {
		tryProviders.push("twilio", "fast2sms", "textbelt");
	}


	const emailPromise = (async () => {
		if (cleanEmail && mailTransporter) {
			await mailTransporter.sendMail({
				from: smtpFrom,
				to: cleanEmail,
				subject: `Order Status Update - ${statusLabel}`,
				text: [
					"Your Brahmaji Traders order status was updated.",
					"",
					`Order: ${orderIdentifier}`,
					`Status: ${statusLabel}`,
					`Amount: ${amountLine}`,
					`Phone: ${order?.customerPhone || "N/A"}`,
					`Placed At: ${orderTimeLine}`,
					"",
					"Items:",
					itemsLine,
					"",
					"Thank you for shopping with Brahmaji Traders.",
				].join("\n"),
			});

			result.emailSent = true;
			result.emailMessage = "Customer email notification sent.";
			return;
		}

		if (!cleanEmail) {
			result.emailMessage = "Customer email unavailable.";
			return;
		}

		result.emailMessage = "SMTP is not configured.";
	})();

	const smsPromise = (async () => {
		if (!cleanPhone) {
			result.smsMessage = "Customer phone unavailable.";
			return;
		}

		const failureMessages = [];
		for (const provider of tryProviders) {
			try {
				if (provider === "twilio") {
					if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone) {
						throw new Error("Twilio credentials missing.");
					}
					await sendViaTwilio();
					result.smsSent = true;
					result.smsMode = "twilio";
					result.smsMessage = "Customer SMS notification sent via Twilio.";
					return;
				}

				if (provider === "fast2sms") {
					if (!fast2SmsApiKey) {
						throw new Error("FAST2SMS_API_KEY missing.");
					}
					await sendViaFast2Sms();
					result.smsSent = true;
					result.smsMode = "fast2sms";
					result.smsMessage = "Customer SMS notification sent via Fast2SMS.";
					return;
				}

				await sendViaTextbelt();
				result.smsSent = true;
				result.smsMode = "textbelt";
				result.smsMessage = "Customer SMS notification sent via Textbelt.";
				return;
			} catch (error) {
				failureMessages.push(`${provider}: ${error.message || "Unknown error"}`);
			}
		}

		if (smsSimulationEnabled) {
			console.log("SMS simulated (provider keys missing)", {
				to: cleanPhone,
				status: statusLabel,
				order: orderIdentifier,
				message: smsText,
			});

			result.smsSent = true;
			result.smsMode = "simulated";
			result.smsMessage = "Customer SMS simulated successfully (provider keys not configured).";
			return;
		}

		result.smsMode = "failed";
		result.smsMessage = `Customer SMS failed: ${failureMessages.join(" | ")}`;
	})();

	await Promise.allSettled([emailPromise, smsPromise]);

	return result;
}

async function saveOrderRecord(orderRecord) {
	if (isMongoConnected) {
		const doc = await OrderModel.create(orderRecord);
		return {
			id: doc._id.toString(),
			method: doc.method,
			status: doc.status,
			amount: doc.amount,
			currency: doc.currency,
			items: doc.items,
			paymentId: doc.paymentId,
			orderId: doc.orderId,
			customerName: doc.customerName,
			customerEmail: doc.customerEmail,
			customerPhone: doc.customerPhone,
			customerAddress: doc.customerAddress,
			cancelReason: doc.cancelReason || "",
			cancelledAt: doc.cancelledAt || null,
			cancelledBy: doc.cancelledBy || null,
			deliveredAt: doc.deliveredAt || null,
			returnRequested: Boolean(doc.returnRequested),
			returnReason: doc.returnReason || "",
			returnRequestedAt: doc.returnRequestedAt || null,
			returnWindowEndsAt: doc.returnWindowEndsAt || null,
			returnStatus: doc.returnStatus || "none",
			returnedAt: doc.returnedAt || null,
			notified: doc.notified,
			notifyMessage: doc.notifyMessage,
			createdAt: doc.createdAt,
		};
	}

	const fallbackOrder = {
		id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
		...orderRecord,
		createdAt: new Date().toISOString(),
	};

	orderHistory.unshift(fallbackOrder);
	if (orderHistory.length > 200) {
		orderHistory.pop();
	}

	await persistLocalState();

	return fallbackOrder;
}

async function fetchRecentOrders() {
	if (isMongoConnected) {
		const docs = await OrderModel.find({}).sort({ createdAt: -1 }).limit(200).lean();
		return docs.map((doc) => ({
			id: doc._id.toString(),
			method: doc.method,
			status: doc.status,
			amount: doc.amount,
			currency: doc.currency,
			items: doc.items,
			paymentId: doc.paymentId,
			orderId: doc.orderId,
			customerName: doc.customerName,
			customerEmail: doc.customerEmail,
			customerPhone: doc.customerPhone,
			customerAddress: doc.customerAddress,
			cancelReason: doc.cancelReason || "",
			cancelledAt: doc.cancelledAt || null,
			cancelledBy: doc.cancelledBy || null,
			deliveredAt: doc.deliveredAt || null,
			returnRequested: Boolean(doc.returnRequested),
			returnReason: doc.returnReason || "",
			returnRequestedAt: doc.returnRequestedAt || null,
			returnWindowEndsAt: doc.returnWindowEndsAt || null,
			returnStatus: doc.returnStatus || "none",
			returnedAt: doc.returnedAt || null,
			notified: doc.notified,
			notifyMessage: doc.notifyMessage,
			createdAt: doc.createdAt,
		}));
	}

	return orderHistory;
}

async function saveProductRatingRecord(record) {
	if (isMongoConnected) {
		const doc = await ProductRatingModel.create(record);
		return {
			id: doc._id.toString(),
			productId: doc.productId,
			productName: doc.productName,
			price: doc.price,
			rating: doc.rating,
			customerEmail: doc.customerEmail,
			message: doc.message,
			createdAt: doc.createdAt,
		};
	}

	const fallbackRating = {
		id: `rate_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
		...record,
		createdAt: new Date().toISOString(),
	};

	ratingHistory.unshift(fallbackRating);
	if (ratingHistory.length > 300) {
		ratingHistory.pop();
	}

	await persistLocalState();

	return fallbackRating;
}

async function fetchRecentProductRatings() {
	if (isMongoConnected) {
		const docs = await ProductRatingModel.find({}).sort({ createdAt: -1 }).limit(300).lean();
		return docs.map((doc) => ({
			id: doc._id.toString(),
			productId: doc.productId,
			productName: doc.productName,
			price: doc.price,
			rating: doc.rating,
			customerEmail: doc.customerEmail,
			message: doc.message,
			createdAt: doc.createdAt,
		}));
	}

	return ratingHistory;
}

async function saveCustomerAccountRecord(record) {
	const normalizedEmail = normalizeEmail(record?.email);
	const normalizedRecord = {
		...record,
		email: normalizedEmail,
	};

	if (!normalizedEmail) {
		throw new Error("Customer email is required.");
	}

	if (isMongoConnected) {
		const doc = await CustomerAccountModel.findOneAndUpdate(
			{ email: normalizedEmail },
			{ $set: normalizedRecord },
			{ upsert: true, new: true }
		).lean();

		return {
			id: doc._id.toString(),
			name: doc.name,
			email: doc.email,
			maskedPassword: "********",
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}

	const existingIndex = accountHistory.findIndex(
		(item) => normalizeEmail(item.email) === normalizedEmail
	);
	const fallbackAccount = {
		id:
			existingIndex >= 0
				? accountHistory[existingIndex].id
				: `acct_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
		...normalizedRecord,
		updatedAt: new Date().toISOString(),
		createdAt:
			existingIndex >= 0
				? accountHistory[existingIndex].createdAt
				: new Date().toISOString(),
	};

	if (existingIndex >= 0) {
		accountHistory[existingIndex] = fallbackAccount;
	} else {
		accountHistory.unshift(fallbackAccount);
	}

	if (accountHistory.length > 300) {
		accountHistory.pop();
	}

	await persistLocalState();

	return {
		id: fallbackAccount.id,
		name: fallbackAccount.name,
		email: fallbackAccount.email,
		maskedPassword: "********",
		createdAt: fallbackAccount.createdAt,
		updatedAt: fallbackAccount.updatedAt,
	};
}

async function fetchCustomerAccounts() {
	if (isMongoConnected) {
		const docs = await CustomerAccountModel.find({}).sort({ updatedAt: -1 }).limit(300).lean();
		return docs.map((doc) => ({
			id: doc._id.toString(),
			name: doc.name,
			email: doc.email,
			maskedPassword: "********",
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		}));
	}

	return accountHistory.map((account) => ({
		id: account.id,
		name: account.name,
		email: account.email,
		maskedPassword: "********",
		createdAt: account.createdAt,
		updatedAt: account.updatedAt,
	}));
}

async function findCustomerAccountByEmail(email) {
	const cleanEmail = normalizeEmail(email);
	if (!cleanEmail) {
		return null;
	}

	if (isMongoConnected) {
		let doc = await CustomerAccountModel.findOne({ email: cleanEmail }).lean();
		if (!doc) {
			const looseMatchRegex = new RegExp(`^\\s*${escapeRegex(cleanEmail)}\\s*$`, "i");
			doc = await CustomerAccountModel.findOne({ email: looseMatchRegex }).lean();
		}

		if (!doc) {
			return null;
		}

		return {
			id: doc._id.toString(),
			name: doc.name,
			email: doc.email,
			passwordHash: doc.passwordHash || "",
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}

	const fallback = accountHistory.find(
		(item) => normalizeEmail(item.email) === cleanEmail
	);
	if (!fallback) {
		return null;
	}

	return {
		id: fallback.id,
		name: fallback.name,
		email: fallback.email,
		passwordHash: fallback.passwordHash || "",
		createdAt: fallback.createdAt,
		updatedAt: fallback.updatedAt,
	};
}

async function saveChatIssueRecord(record) {
	if (isMongoConnected) {
		const doc = await ChatIssueModel.create(record);
		return {
			id: doc._id.toString(),
			customerEmail: doc.customerEmail,
			issueText: doc.issueText,
			botReply: doc.botReply,
			createdAt: doc.createdAt,
		};
	}

	const fallbackIssue = {
		id: `chat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
		...record,
		createdAt: new Date().toISOString(),
	};

	chatIssueHistory.unshift(fallbackIssue);
	if (chatIssueHistory.length > 500) {
		chatIssueHistory.pop();
	}

	await persistLocalState();

	return fallbackIssue;
}

async function fetchChatIssueRecords() {
	if (isMongoConnected) {
		const docs = await ChatIssueModel.find({}).sort({ createdAt: -1 }).limit(500).lean();
		return docs.map((doc) => ({
			id: doc._id.toString(),
			customerEmail: doc.customerEmail,
			issueText: doc.issueText,
			botReply: doc.botReply,
			createdAt: doc.createdAt,
		}));
	}

	return chatIssueHistory;
}

app.get("/api/health", (req, res) => {
	res.json({
		ok: true,
		message: "Payment backend is running.",
		storage: storageMode,
	});
});

app.get("/api/market/live", async (req, res) => {
	try {
		const marketData = await fetchLiveMarketQuotes();
		return res.json({
			success: true,
			...marketData,
		});
	} catch (error) {
		return res.status(502).json({
			success: false,
			message: error.message || "Unable to fetch live market data.",
		});
	}
});

app.get("/api/payment/key", (req, res) => {
	if (!razorpayKeyId) {
		return res.status(500).json({ message: "RAZORPAY_KEY_ID is not configured." });
	}

	return res.json({ key: razorpayKeyId });
});

app.post("/api/payment/create-order", async (req, res) => {
	try {
		if (!razorpay) {
			return res.status(500).json({ message: "Razorpay keys are missing in backend environment." });
		}

		const { amount, currency = "INR", notes = {} } = req.body;
		const parsedAmount = Number(amount);

		if (!parsedAmount || parsedAmount <= 0) {
			return res.status(400).json({ message: "Amount must be greater than 0." });
		}

		const order = await razorpay.orders.create({
			amount: Math.round(parsedAmount * 100),
			currency,
			receipt: `receipt_${Date.now()}`,
			notes,
		});

		return res.json(order);
	} catch (error) {
		return res.status(500).json({ message: error.message || "Unable to create Razorpay order." });
	}
});

app.post("/api/payment/verify", (req, res) => {
	try {
		const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

		if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
			return res.status(400).json({ success: false, message: "Missing payment verification fields." });
		}

		if (!razorpayKeySecret) {
			return res.status(500).json({ success: false, message: "RAZORPAY_KEY_SECRET is not configured." });
		}

		const expectedSignature = crypto
			.createHmac("sha256", razorpayKeySecret)
			.update(`${razorpay_order_id}|${razorpay_payment_id}`)
			.digest("hex");

		const isValid = expectedSignature === razorpay_signature;

		if (!isValid) {
			return res.status(400).json({ success: false, message: "Invalid payment signature." });
		}

		return res.json({
			success: true,
			message: "Payment verified successfully.",
			paymentId: razorpay_payment_id,
			orderId: razorpay_order_id,
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: error.message || "Verification failed." });
	}
});

app.post("/api/order/notify", async (req, res) => {
	try {
		const {
			method,
			amount,
			currency = "INR",
			items = [],
			paymentId,
			orderId,
			customerName,
			customerEmail,
			customerPhone,
			customerAddress,
		} = req.body || {};
		const customerEmailFromHeader = String(req.headers["x-user-email"] || "").trim().toLowerCase();
		const normalizedCustomerEmail = customerEmail
			? String(customerEmail).trim().toLowerCase()
			: customerEmailFromHeader;

		if (!["online", "cod"].includes(method)) {
			return res.status(400).json({ success: false, message: "Invalid order method." });
		}

		const parsedAmount = Number(amount);
		if (!parsedAmount || parsedAmount <= 0) {
			return res.status(400).json({ success: false, message: "Amount must be greater than 0." });
		}

		const notifyResult = await sendOwnerOrderNotification({
			method,
			amount: parsedAmount,
			currency,
			items,
			paymentId,
			orderId,
			customerName,
			customerPhone,
			customerAddress,
		});

		if (!notifyResult.notified) {
			console.log("Order received without email notification:", {
				method,
				amount: parsedAmount,
				currency,
				items,
				paymentId,
				orderId,
			});
		}

		const savedOrder = await saveOrderRecord({
			method,
			amount: parsedAmount,
			currency,
			items,
			paymentId: paymentId || null,
			orderId: orderId || null,
			customerName: customerName || null,
			customerEmail: normalizedCustomerEmail || null,
			customerPhone: customerPhone || null,
			customerAddress: customerAddress || null,
			notified: notifyResult.notified,
			notifyMessage: notifyResult.message,
			status: "new",
		});

		return res.json({
			success: true,
			notified: notifyResult.notified,
			message: notifyResult.message,
			order: savedOrder,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to send order notification.",
		});
	}
});

app.post("/api/account/notify", async (req, res) => {
	try {
		const { name, email, password } = req.body || {};
		const cleanEmail = String(email || "").trim().toLowerCase();
		const cleanPassword = String(password || "").trim();

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Email is required." });
		}

		if (!cleanPassword) {
			return res.status(400).json({ success: false, message: "Password is required." });
		}

		const passwordHash = await bcrypt.hash(cleanPassword, 10);

		const notifyResult = await sendNewAccountNotification({
			name: String(name || "").trim(),
			email: cleanEmail,
		});

		const savedAccount = await saveCustomerAccountRecord({
			name: String(name || "").trim(),
			email: cleanEmail,
			passwordHash,
		});

		return res.json({
			success: true,
			notified: notifyResult.notified,
			message: notifyResult.message,
			account: savedAccount,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to send account notification.",
		});
	}
});

app.post("/api/account/sync", async (req, res) => {
	try {
		const { name, email, password } = req.body || {};
		const cleanEmail = String(email || "").trim().toLowerCase();
		const cleanPassword = String(password || "").trim();

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Email is required." });
		}

		if (!cleanPassword) {
			return res.status(400).json({ success: false, message: "Password is required." });
		}

		const passwordHash = await bcrypt.hash(cleanPassword, 10);

		const savedAccount = await saveCustomerAccountRecord({
			name: String(name || "").trim(),
			email: cleanEmail,
			passwordHash,
		});

		return res.json({
			success: true,
			message: "Customer account synced successfully.",
			account: savedAccount,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to sync customer account.",
		});
	}
});

app.post("/api/auth/signup", authRateLimiter, async (req, res) => {
	try {
		const { name, email, password } = req.body || {};
		const cleanName = String(name || "").trim();
		const cleanEmail = String(email || "").trim().toLowerCase();
		const cleanPassword = String(password || "").trim();

		if (!cleanName) {
			return res.status(400).json({ success: false, message: "Name is required." });
		}

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Email is required." });
		}

		if (cleanPassword.length < 6) {
			return res.status(400).json({
				success: false,
				message: "Password must be at least 6 characters.",
			});
		}

		const existingAccount = await findCustomerAccountByEmail(cleanEmail);
		if (existingAccount) {
			return res.status(409).json({
				success: false,
				message: "An account already exists with this email.",
			});
		}

		const passwordHash = await bcrypt.hash(cleanPassword, 10);
		const account = await saveCustomerAccountRecord({
			name: cleanName,
			email: cleanEmail,
			passwordHash,
		});

		const notifyResult = await sendNewAccountNotification({
			name: cleanName,
			email: cleanEmail,
		});

		return res.status(201).json({
			success: true,
			message: "Account created successfully.",
			notified: notifyResult.notified,
			account,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to create account.",
		});
	}
});

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
	try {
		const { email, password } = req.body || {};
		const cleanEmail = String(email || "").trim().toLowerCase();
		const cleanPassword = String(password || "").trim();

		if (!cleanEmail || !cleanPassword) {
			return res.status(400).json({
				success: false,
				message: "Email and password are required.",
			});
		}

		const account = await findCustomerAccountByEmail(cleanEmail);
		if (!account || !account.passwordHash) {
			return res.status(401).json({ success: false, message: "Invalid email or password." });
		}

		const isMatch = await bcrypt.compare(cleanPassword, account.passwordHash);
		if (!isMatch) {
			return res.status(401).json({ success: false, message: "Invalid email or password." });
		}

		return res.json({
			success: true,
			message: "Login successful.",
			user: {
				name: account.name,
				email: account.email,
				role: "customer",
			},
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to login.",
		});
	}
});

app.post("/api/auth/request-reset-otp", authRateLimiter, async (req, res) => {
	try {
		clearExpiredPasswordOtps();

		const { email } = req.body || {};
		const cleanEmail = normalizeEmail(email);

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Email is required." });
		}

		const existingAccount = await findCustomerAccountByEmail(cleanEmail);
		if (!existingAccount) {
			return res.status(404).json({
				success: false,
				message: "No account found with this email.",
			});
		}

		const existingOtp = passwordResetOtpStore.get(cleanEmail);
		const now = Date.now();
		if (existingOtp?.lastSentAt && now - existingOtp.lastSentAt < PASSWORD_RESET_RESEND_INTERVAL_MS) {
			const waitSeconds = Math.ceil(
				(PASSWORD_RESET_RESEND_INTERVAL_MS - (now - existingOtp.lastSentAt)) / 1000
			);

			return res.status(429).json({
				success: false,
				message: `Please wait ${waitSeconds}s before requesting a new OTP.`,
			});
		}

		const otp = createOtpCode();
		const notifyResult = await sendPasswordResetOtpNotification({
			email: cleanEmail,
			otp,
		});

		if (!notifyResult.sent) {
			return res.status(503).json({
				success: false,
				message: notifyResult.message || "Failed to send OTP email.",
			});
		}

		passwordResetOtpStore.set(cleanEmail, {
			hash: hashOtp(otp),
			expiresAt: now + PASSWORD_RESET_OTP_TTL_MS,
			attempts: 0,
			lastSentAt: now,
		});

		return res.json({
			success: true,
			message: "OTP sent to your email.",
			expiresInSeconds: Math.floor(PASSWORD_RESET_OTP_TTL_MS / 1000),
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to send password reset OTP.",
		});
	}
});

app.post("/api/auth/verify-reset-otp", authRateLimiter, async (req, res) => {
	try {
		clearExpiredPasswordOtps();

		const { email, otp, newPassword } = req.body || {};
		const cleanEmail = normalizeEmail(email);
		const cleanOtp = String(otp || "").trim();
		const cleanPassword = String(newPassword || "").trim();

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Email is required." });
		}

		if (!cleanOtp || !/^\d{6}$/.test(cleanOtp)) {
			return res.status(400).json({
				success: false,
				message: "Valid 6-digit OTP is required.",
			});
		}

		if (cleanPassword.length < 6) {
			return res.status(400).json({
				success: false,
				message: "New password must be at least 6 characters.",
			});
		}

		const otpRecord = passwordResetOtpStore.get(cleanEmail);
		if (!otpRecord) {
			return res.status(400).json({
				success: false,
				message: "OTP expired or not requested. Please request a new OTP.",
			});
		}

		if ((otpRecord.attempts || 0) >= PASSWORD_RESET_MAX_ATTEMPTS) {
			passwordResetOtpStore.delete(cleanEmail);
			return res.status(429).json({
				success: false,
				message: "Too many invalid OTP attempts. Please request a new OTP.",
			});
		}

		const incomingHash = hashOtp(cleanOtp);
		if (incomingHash !== otpRecord.hash) {
			passwordResetOtpStore.set(cleanEmail, {
				...otpRecord,
				attempts: (otpRecord.attempts || 0) + 1,
			});

			return res.status(400).json({
				success: false,
				message: "Invalid OTP.",
			});
		}

		const existingAccount = await findCustomerAccountByEmail(cleanEmail);
		if (!existingAccount) {
			passwordResetOtpStore.delete(cleanEmail);
			return res.status(404).json({
				success: false,
				message: "No account found with this email.",
			});
		}

		const passwordHash = await bcrypt.hash(cleanPassword, 10);
		await saveCustomerAccountRecord({
			name: existingAccount.name,
			email: cleanEmail,
			passwordHash,
		});

		passwordResetOtpStore.delete(cleanEmail);

		return res.json({
			success: true,
			message: "Password reset successful.",
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to verify OTP.",
		});
	}
});

app.post("/api/auth/reset-password", authRateLimiter, async (req, res) => {
	try {
		const { email, newPassword } = req.body || {};
		const cleanEmail = String(email || "").trim().toLowerCase();
		const cleanPassword = String(newPassword || "").trim();

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Email is required." });
		}

		if (cleanPassword.length < 6) {
			return res.status(400).json({
				success: false,
				message: "New password must be at least 6 characters.",
			});
		}

		const existingAccount = await findCustomerAccountByEmail(cleanEmail);
		if (!existingAccount) {
			return res.status(404).json({
				success: false,
				message: "No account found with this email.",
			});
		}

		const passwordHash = await bcrypt.hash(cleanPassword, 10);
		await saveCustomerAccountRecord({
			name: existingAccount.name,
			email: cleanEmail,
			passwordHash,
		});

		return res.json({
			success: true,
			message: "Password reset successful.",
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to reset password.",
		});
	}
});

app.get("/api/accounts", async (req, res) => {
	try {
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		if (!["admin", "developer"].includes(userRole)) {
			return res.status(403).json({
				success: false,
				message: "Only admin/developer can view customer login accounts.",
			});
		}

		const accounts = await fetchCustomerAccounts();
		return res.json({
			success: true,
			count: accounts.length,
			accounts,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to fetch customer login accounts.",
		});
	}
});

app.post("/api/chat/issues", async (req, res) => {
	try {
		const { customerEmail, issueText, botReply } = req.body || {};
		const cleanEmail = String(customerEmail || "").trim().toLowerCase();
		const cleanIssueText = String(issueText || "").trim();
		const cleanBotReply = String(botReply || "").trim();

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Customer email is required." });
		}

		if (!cleanIssueText) {
			return res.status(400).json({ success: false, message: "Issue text is required." });
		}

		const savedIssue = await saveChatIssueRecord({
			customerEmail: cleanEmail,
			issueText: cleanIssueText,
			botReply: cleanBotReply,
		});

		return res.json({
			success: true,
			message: "Chat issue stored successfully.",
			issue: savedIssue,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to store chat issue.",
		});
	}
});

app.get("/api/chat/issues", async (req, res) => {
	try {
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		if (!["admin", "developer"].includes(userRole)) {
			return res.status(403).json({
				success: false,
				message: "Only admin/developer can view customer AI chat issues.",
			});
		}

		const issues = await fetchChatIssueRecords();
		return res.json({
			success: true,
			count: issues.length,
			issues,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to fetch chat issues.",
		});
	}
});

app.post("/api/product/rating/notify", async (req, res) => {
	try {
		const {
			productId,
			productName,
			price,
			rating,
			customerEmail,
			message,
		} = req.body || {};

		const cleanRating = Number(rating);
		const cleanEmail = String(customerEmail || "").trim().toLowerCase();

		if (!productName) {
			return res.status(400).json({ success: false, message: "Product name is required." });
		}

		if (!cleanEmail) {
			return res.status(400).json({ success: false, message: "Customer email is required." });
		}

		if (!cleanRating || cleanRating < 1 || cleanRating > 5) {
			return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
		}

		const notifyResult = await sendProductRatingNotification({
			productId,
			productName,
			price,
			rating: cleanRating,
			customerEmail: cleanEmail,
			message: String(message || "").trim(),
		});

		const savedRating = await saveProductRatingRecord({
			productId: String(productId || "").trim(),
			productName: String(productName).trim(),
			price: Number(price || 0),
			rating: cleanRating,
			customerEmail: cleanEmail,
			message: String(message || "").trim(),
		});

		return res.json({
			success: true,
			notified: notifyResult.notified,
			message: notifyResult.message,
			rating: savedRating,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to send product rating notification.",
		});
	}
});

app.get("/api/product/ratings", async (req, res) => {
	try {
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		if (!["admin", "developer"].includes(userRole)) {
			return res.status(403).json({
				success: false,
				message: "Only admin/developer can view customer rating logs.",
			});
		}

		const ratings = await fetchRecentProductRatings();
		return res.json({
			success: true,
			count: ratings.length,
			ratings,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to fetch product ratings.",
		});
	}
});

app.get("/api/product/stock-meta", async (req, res) => {
	try {
		return res.json({
			success: true,
			meta: productStockMeta,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to fetch product stock metadata.",
		});
	}
});

app.put("/api/product/stock-meta/:id", async (req, res) => {
	try {
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		if (!['admin', 'developer'].includes(userRole)) {
			return res.status(403).json({
				success: false,
				message: "Only admin/developer can update product stock.",
			});
		}

		const { id } = req.params;
		const cleanId = String(id || "").trim();
		const stockQty = Number(req.body?.stockQty);

		if (!cleanId) {
			return res.status(400).json({
				success: false,
				message: "Product id is required.",
			});
		}

		if (!Number.isFinite(stockQty) || stockQty < 0) {
			return res.status(400).json({
				success: false,
				message: "stockQty must be a non-negative number.",
			});
		}

		const updatedBy = normalizeEmail(String(req.headers["x-user-email"] || ""));
		productStockMeta[cleanId] = {
			stockQty: Math.floor(stockQty),
			updatedAt: new Date().toISOString(),
			updatedBy: updatedBy || null,
		};

		await persistLocalState();

		return res.json({
			success: true,
			message: "Product stock updated.",
			meta: productStockMeta[cleanId],
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to update product stock.",
		});
	}
});

app.get("/api/orders", async (req, res) => {
	try {
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		const userEmail = String(req.headers["x-user-email"] || "").trim().toLowerCase();
		const allOrders = await fetchRecentOrders();
		const orders = userRole === "customer"
			? allOrders.filter((order) => String(order.customerEmail || "").toLowerCase() === userEmail)
			: allOrders;
		return res.json({
			success: true,
			count: orders.length,
			orders,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to fetch orders.",
		});
	}
});

app.patch("/api/orders/:id/status", async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body || {};
		const normalizedStatus = String(status || "").toLowerCase() === "done" ? "delivered" : status;
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		const userEmail = String(req.headers["x-user-email"] || "").toLowerCase();
		const allowedStatus = ["new", "accepted", "packed", "shipped", "delivered", "rejected", "cancelled"];
		const isPrivilegedUser = ["admin", "developer"].includes(userRole);

		if (!isPrivilegedUser || userEmail !== String(ownerNotificationEmail || "").toLowerCase()) {
			return res.status(403).json({
				success: false,
				message: "Only admin/developer can update order status.",
			});
		}

		if (!allowedStatus.includes(normalizedStatus)) {
			return res.status(400).json({ success: false, message: "Invalid status value." });
		}

		if (isMongoConnected) {
			const statusUpdateFields = { status: normalizedStatus };
			if (normalizedStatus === "delivered") {
				const deliveredAt = new Date();
				statusUpdateFields.deliveredAt = deliveredAt;
				statusUpdateFields.returnWindowEndsAt = new Date(deliveredAt.getTime() + RETURN_WINDOW_MS);
				statusUpdateFields.returnRequested = false;
				statusUpdateFields.returnReason = "";
				statusUpdateFields.returnRequestedAt = null;
				statusUpdateFields.returnStatus = "none";
				statusUpdateFields.returnedAt = null;
			}

			const updated = await OrderModel.findByIdAndUpdate(
				id,
				{ $set: statusUpdateFields },
				{ new: true }
			).lean();

			if (!updated) {
				return res.status(404).json({ success: false, message: "Order not found." });
			}

			const notifyResult = await sendCustomerOrderStatusNotification(
				{
					id: updated._id?.toString(),
					orderId: updated.orderId,
					customerEmail: updated.customerEmail,
					customerPhone: updated.customerPhone,
					currency: updated.currency,
					amount: updated.amount,
					items: updated.items,
					createdAt: updated.createdAt,
				},
				updated.status
			);

			return res.json({
				success: true,
				message: "Order status updated.",
				status: updated.status,
				order: {
					id: updated._id.toString(),
					status: updated.status,
					deliveredAt: updated.deliveredAt || null,
					returnRequested: Boolean(updated.returnRequested),
					returnReason: updated.returnReason || "",
					returnRequestedAt: updated.returnRequestedAt || null,
					returnWindowEndsAt: updated.returnWindowEndsAt || null,
					returnStatus: updated.returnStatus || "none",
					returnedAt: updated.returnedAt || null,
				},
				notifications: notifyResult,
			});
		}

		const found = orderHistory.find((o) => o.id === id);
		if (!found) {
			return res.status(404).json({ success: false, message: "Order not found." });
		}

		found.status = normalizedStatus;
		if (normalizedStatus === "delivered") {
			const deliveredAt = new Date().toISOString();
			found.deliveredAt = deliveredAt;
			found.returnWindowEndsAt = new Date(Date.now() + RETURN_WINDOW_MS).toISOString();
			found.returnRequested = false;
			found.returnReason = "";
			found.returnRequestedAt = null;
			found.returnStatus = "none";
			found.returnedAt = null;
		}
		await persistLocalState();
		const notifyResult = await sendCustomerOrderStatusNotification(found, found.status);
		return res.json({
			success: true,
			message: "Order status updated.",
			status: found.status,
			order: {
				id: found.id,
				status: found.status,
				deliveredAt: found.deliveredAt || null,
				returnRequested: Boolean(found.returnRequested),
				returnReason: found.returnReason || "",
				returnRequestedAt: found.returnRequestedAt || null,
				returnWindowEndsAt: found.returnWindowEndsAt || null,
				returnStatus: found.returnStatus || "none",
				returnedAt: found.returnedAt || null,
			},
			notifications: notifyResult,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to update order status.",
		});
	}
});

app.patch("/api/orders/:id/return", async (req, res) => {
	try {
		const { id } = req.params;
		const reason = String(req.body?.reason || "").trim();
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		const userEmail = normalizeEmail(String(req.headers["x-user-email"] || ""));

		if (userRole !== "customer") {
			return res.status(403).json({
				success: false,
				message: "Only customer can request return from customer portal.",
			});
		}

		if (!userEmail) {
			return res.status(400).json({
				success: false,
				message: "Customer email is required.",
			});
		}

		if (reason.length < 3) {
			return res.status(400).json({
				success: false,
				message: "Please provide a valid return reason.",
			});
		}

		const validateWindow = (order) => {
			const status = String(order?.status || "").toLowerCase();
			if (status !== "delivered") {
				return { ok: false, message: "Return is available only for delivered orders." };
			}

			const existingReturnStatus = String(order?.returnStatus || "none").toLowerCase();
			if (["requested", "approved", "completed"].includes(existingReturnStatus)) {
				return { ok: false, message: "Return request is already active for this order." };
			}

			const deliveredAtSource = order?.deliveredAt || order?.updatedAt || order?.createdAt;
			const deliveredTime = new Date(deliveredAtSource).getTime();
			if (!Number.isFinite(deliveredTime)) {
				return { ok: false, message: "Delivered date is unavailable for this order." };
			}

			const windowEndsAt = order?.returnWindowEndsAt
				? new Date(order.returnWindowEndsAt).getTime()
				: deliveredTime + RETURN_WINDOW_MS;

			if (!Number.isFinite(windowEndsAt)) {
				return { ok: false, message: "Return window is unavailable for this order." };
			}

			if (Date.now() > windowEndsAt) {
				return { ok: false, message: "Return window closed. Return can be requested within 7 days of delivery." };
			}

			return {
				ok: true,
				deliveredAt: new Date(deliveredTime),
				windowEndsAt: new Date(windowEndsAt),
			};
		};

		if (isMongoConnected) {
			const found = await OrderModel.findById(id).lean();
			if (!found) {
				return res.status(404).json({ success: false, message: "Order not found." });
			}

			if (normalizeEmail(found.customerEmail) !== userEmail) {
				return res.status(403).json({
					success: false,
					message: "You can request return only for your own order.",
				});
			}

			const check = validateWindow(found);
			if (!check.ok) {
				return res.status(400).json({ success: false, message: check.message });
			}

			const now = new Date();
			const updated = await OrderModel.findByIdAndUpdate(
				id,
				{
					$set: {
						returnRequested: true,
						returnReason: reason,
						returnRequestedAt: now,
						returnStatus: "requested",
						deliveredAt: found.deliveredAt || check.deliveredAt,
						returnWindowEndsAt: found.returnWindowEndsAt || check.windowEndsAt,
					},
				},
				{ new: true }
			).lean();

			return res.json({
				success: true,
				message: "Return request submitted successfully.",
				order: {
					id: updated._id.toString(),
					status: updated.status,
					returnRequested: Boolean(updated.returnRequested),
					returnReason: updated.returnReason || "",
					returnRequestedAt: updated.returnRequestedAt || null,
					returnWindowEndsAt: updated.returnWindowEndsAt || null,
					returnStatus: updated.returnStatus || "none",
					deliveredAt: updated.deliveredAt || null,
				},
			});
		}

		const found = orderHistory.find((order) => order.id === id);
		if (!found) {
			return res.status(404).json({ success: false, message: "Order not found." });
		}

		if (normalizeEmail(found.customerEmail) !== userEmail) {
			return res.status(403).json({
				success: false,
				message: "You can request return only for your own order.",
			});
		}

		const check = validateWindow(found);
		if (!check.ok) {
			return res.status(400).json({ success: false, message: check.message });
		}

		found.returnRequested = true;
		found.returnReason = reason;
		found.returnRequestedAt = new Date().toISOString();
		found.returnStatus = "requested";
		found.deliveredAt = found.deliveredAt || check.deliveredAt.toISOString();
		found.returnWindowEndsAt = found.returnWindowEndsAt || check.windowEndsAt.toISOString();
		await persistLocalState();

		return res.json({
			success: true,
			message: "Return request submitted successfully.",
			order: {
				id: found.id,
				status: found.status,
				returnRequested: Boolean(found.returnRequested),
				returnReason: found.returnReason || "",
				returnRequestedAt: found.returnRequestedAt || null,
				returnWindowEndsAt: found.returnWindowEndsAt || null,
				returnStatus: found.returnStatus || "none",
				deliveredAt: found.deliveredAt || null,
			},
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to request return.",
		});
	}
});

app.patch("/api/orders/:id/cancel", async (req, res) => {
	try {
		const { id } = req.params;
		const reason = String(req.body?.reason || "").trim();
		const userRole = String(req.headers["x-user-role"] || "").toLowerCase();
		const userEmail = normalizeEmail(String(req.headers["x-user-email"] || ""));

		if (userRole !== "customer") {
			return res.status(403).json({
				success: false,
				message: "Only customer can cancel order from customer portal.",
			});
		}

		if (!userEmail) {
			return res.status(400).json({
				success: false,
				message: "Customer email is required.",
			});
		}

		if (reason.length < 3) {
			return res.status(400).json({
				success: false,
				message: "Please provide a valid cancel reason.",
			});
		}

		const nonCancellableStatuses = ["delivered", "rejected", "cancelled"];

		if (isMongoConnected) {
			const found = await OrderModel.findById(id).lean();
			if (!found) {
				return res.status(404).json({ success: false, message: "Order not found." });
			}

			if (normalizeEmail(found.customerEmail) !== userEmail) {
				return res.status(403).json({
					success: false,
					message: "You can cancel only your own order.",
				});
			}

			if (nonCancellableStatuses.includes(String(found.status || "").toLowerCase())) {
				return res.status(400).json({
					success: false,
					message: `Order cannot be cancelled when status is ${found.status}.`,
				});
			}

			const updated = await OrderModel.findByIdAndUpdate(
				id,
				{
					$set: {
						status: "cancelled",
						cancelReason: reason,
						cancelledAt: new Date(),
						cancelledBy: userEmail,
					},
				},
				{ new: true }
			).lean();

			return res.json({
				success: true,
				message: "Order cancelled successfully.",
				order: {
					id: updated._id.toString(),
					status: updated.status,
					cancelReason: updated.cancelReason || "",
					cancelledAt: updated.cancelledAt || null,
					cancelledBy: updated.cancelledBy || null,
				},
			});
		}

		const found = orderHistory.find((order) => order.id === id);
		if (!found) {
			return res.status(404).json({ success: false, message: "Order not found." });
		}

		if (normalizeEmail(found.customerEmail) !== userEmail) {
			return res.status(403).json({
				success: false,
				message: "You can cancel only your own order.",
			});
		}

		if (nonCancellableStatuses.includes(String(found.status || "").toLowerCase())) {
			return res.status(400).json({
				success: false,
				message: `Order cannot be cancelled when status is ${found.status}.`,
			});
		}

		found.status = "cancelled";
		found.cancelReason = reason;
		found.cancelledAt = new Date().toISOString();
		found.cancelledBy = userEmail;
		await persistLocalState();

		return res.json({
			success: true,
			message: "Order cancelled successfully.",
			order: {
				id: found.id,
				status: found.status,
				cancelReason: found.cancelReason || "",
				cancelledAt: found.cancelledAt || null,
				cancelledBy: found.cancelledBy || null,
			},
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: error.message || "Failed to cancel order.",
		});
	}
});

connectMongo().finally(() => {
	const server = app.listen(port, () => {
		console.log(`Backend server running on http://localhost:${port}`);
	});

	server.on("error", (error) => {
		if (error?.code === "EADDRINUSE") {
			console.log(
				`Port ${port} is already in use. Stop the old backend process and run "npm run server" again.`
			);
			process.exit(1);
			return;
		}

		console.log(`Backend startup error: ${error?.message || "Unknown error"}`);
		process.exit(1);
	});
});
