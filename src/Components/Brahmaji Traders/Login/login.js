export const AUTH_EMAIL = "brahmajitraders9@gmail.com";
export const AUTH_PASSWORD = "password123";
const ACCOUNTS_STORAGE_KEY = "brahmaji_traders_accounts";
const LAST_ACCOUNT_EMAIL_KEY = "brahmaji_traders_last_account_email";

function readStoredAccounts() {
	try {
		const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.filter((item) => item?.email && item?.password)
			.map((item) => ({
				name: String(item.name || "").trim(),
				email: String(item.email).trim().toLowerCase(),
				password: String(item.password),
			}));
	} catch {
		return [];
	}
}

function writeStoredAccounts(accounts) {
	localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

export function getUserRole(email) {
	const cleanEmail = String(email || "").trim().toLowerCase();
	if (cleanEmail === AUTH_EMAIL) {
		return "admin";
	}

	return "customer";
}

export function getStoredAccount() {
	const accounts = readStoredAccounts();
	if (accounts.length === 0) {
		return null;
	}

	const lastEmail = String(localStorage.getItem(LAST_ACCOUNT_EMAIL_KEY) || "")
		.trim()
		.toLowerCase();
	if (lastEmail) {
		const matched = accounts.find((item) => item.email === lastEmail);
		if (matched) {
			return matched;
		}
	}

	return accounts[accounts.length - 1] || null;
}

export function createAccount({ name, email, password }) {
	const cleanName = String(name || "").trim();
	const cleanEmail = String(email || "").trim().toLowerCase();
	const cleanPassword = String(password || "").trim();

	if (!cleanName) {
		return "Please enter your name.";
	}

	if (!cleanEmail) {
		return "Please enter your email address.";
	}

	if (!cleanPassword) {
		return "Please enter a password.";
	}

	if (cleanEmail === AUTH_EMAIL) {
		return "This email is reserved for admin login.";
	}

	if (cleanPassword.length < 6) {
		return "Password must be at least 6 characters.";
	}

	const accounts = readStoredAccounts();
	if (accounts.some((item) => item.email === cleanEmail)) {
		return "Account already exists with this email. Please login.";
	}

	const account = {
		name: cleanName,
		email: cleanEmail,
		password: cleanPassword,
	};

	writeStoredAccounts([...accounts, account]);
	localStorage.setItem(LAST_ACCOUNT_EMAIL_KEY, cleanEmail);
	return "";
}

export function resetPassword({ email, newPassword }) {
	const cleanEmail = String(email || "").trim().toLowerCase();
	const cleanPassword = String(newPassword || "").trim();

	if (!cleanEmail) {
		return "Please enter your email address.";
	}

	if (!cleanPassword) {
		return "Please enter a new password.";
	}

	if (cleanPassword.length < 6) {
		return "Password must be at least 6 characters.";
	}

	if (cleanEmail === AUTH_EMAIL) {
		return "Admin password cannot be reset from customer flow.";
	}

	const accounts = readStoredAccounts();
	const targetIndex = accounts.findIndex((item) => item.email === cleanEmail);
	if (targetIndex < 0) {
		return "Email not found. Please create a new account first.";
	}

	const nextAccounts = [...accounts];
	nextAccounts[targetIndex] = {
		...nextAccounts[targetIndex],
		password: cleanPassword,
	};
	writeStoredAccounts(nextAccounts);
	localStorage.setItem(LAST_ACCOUNT_EMAIL_KEY, cleanEmail);
	return "";
}

export function validateLogin(email, password, loginView = "customer") {
	const cleanEmail = String(email || "").trim().toLowerCase();
	const cleanPassword = String(password || "").trim();
	const isAdminLogin = loginView === "admin";

	if (!cleanEmail) {
		return "Please enter your email address.";
	}

	if (!cleanPassword) {
		return "Please enter your password.";
	}

	if (cleanPassword.length < 6) {
		return "Password must be at least 6 characters.";
	}

	if (isAdminLogin) {
		if (cleanEmail === AUTH_EMAIL && cleanPassword === AUTH_PASSWORD) {
			return "";
		}

		return "Only admin credentials are allowed for admin login.";
	}

	if (cleanEmail === AUTH_EMAIL) {
		return "Admin credentials can be used only in Admin Login.";
	}

	const accounts = readStoredAccounts();
	const matched = accounts.find(
		(item) => item.email === cleanEmail && item.password === cleanPassword
	);
	if (matched) {
		localStorage.setItem(LAST_ACCOUNT_EMAIL_KEY, cleanEmail);
		return "";
	}

	return "Invalid email or password.";
}
