import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Login.css";
import {
	AUTH_EMAIL,
	AUTH_PASSWORD,
	getStoredAccount,
	validateLogin,
} from "./login.js";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";

async function postAuth(endpoint, payload) {
	const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
	const requestOptions = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	};

	const tryRequest = async (url) => {
		const response = await fetch(url, requestOptions);
		let data = null;
		try {
			data = await response.json();
		} catch {
			data = null;
		}

		if (!response.ok) {
			throw new Error(data?.message || "Authentication request failed.");
		}

		return data;
	};

	try {
		return await tryRequest(primaryUrl);
	} catch (error) {
		if (API_BASE_URL) {
			throw error;
		}
		return await tryRequest(`${FALLBACK_API_BASE_URL}${endpoint}`);
	}
}

function Login({
	onLogin,
	allowAdmin = true,
	adminOnly = false,
}) {
	const [formData, setFormData] = useState({ email: "", password: "" });
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [mode, setMode] = useState("login");
	const [loginView, setLoginView] = useState(adminOnly ? "admin" : "customer");
	const [statusMessage, setStatusMessage] = useState("");
	const [createError, setCreateError] = useState("");
	const [accountData, setAccountData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [forgotData, setForgotData] = useState({
		email: "",
		otp: "",
		newPassword: "",
		confirmPassword: "",
	});
	const [forgotError, setForgotError] = useState("");
	const [isOtpSending, setIsOtpSending] = useState(false);
	const [isOtpSent, setIsOtpSent] = useState(false);
	const [successPopup, setSuccessPopup] = useState("");

	useEffect(() => {
		if (!adminOnly) {
			return;
		}

		setMode("login");
		setLoginView("admin");
		setError("");
		setStatusMessage("");
		setFormData({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
	}, [adminOnly]);

	const handleFieldChange = (event) => {
		const { name, value } = event.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
		if (error) {
			setError("");
		}
		if (statusMessage) {
			setStatusMessage("");
		}
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		const cleanEmail = formData.email.trim().toLowerCase();
		const cleanPassword = formData.password;

		if (!cleanEmail || !cleanPassword) {
			setError("Email and password are required.");
			return;
		}

		if ((adminOnly || loginView === "admin") && cleanEmail !== AUTH_EMAIL) {
			setError("Please enter your email first.");
			return;
		}

		if (adminOnly || loginView === "admin") {
			if (cleanEmail !== AUTH_EMAIL || cleanPassword !== AUTH_PASSWORD) {
				setError("Invalid admin email or password.");
				return;
			}

			if (typeof onLogin === "function") {
				onLogin({ email: cleanEmail, role: "admin" });
			}
			return;
		}

		try {
			const result = await postAuth("/api/auth/login", {
				email: cleanEmail,
				password: cleanPassword,
			});
			if (typeof onLogin === "function") {
				onLogin({
					email: result?.user?.email || cleanEmail,
					role: "customer",
				});
			}
		} catch (authError) {
			const localValidationError = validateLogin(cleanEmail, cleanPassword, "customer");
			if (!localValidationError) {
				const stored = getStoredAccount();
				const fallbackName =
					stored?.email === cleanEmail
						? stored?.name || ""
						: cleanEmail.split("@")[0] || "Customer";

				try {
					await postAuth("/api/auth/signup", {
						name: fallbackName,
						email: cleanEmail,
						password: cleanPassword,
					});
				} catch {
					// Ignore sync failures; local auth already passed.
				}

				if (typeof onLogin === "function") {
					onLogin({
						email: cleanEmail,
						role: "customer",
					});
				}
				return;
			}

			setError(authError.message || "Login failed. Please try again.");
		}
	};

	const switchToAdminLogin = () => {
		if (!allowAdmin) {
			return;
		}
		setLoginView("admin");
		setMode("login");
		setError("");
		setStatusMessage("");
		setFormData({ email: AUTH_EMAIL, password: AUTH_PASSWORD });
	};

	const switchToCustomerLogin = () => {
		if (adminOnly) {
			return;
		}
		setLoginView("customer");
		setMode("login");
		setError("");
		setStatusMessage("");
		const stored = getStoredAccount();
		setFormData({
			email: stored?.email || "",
			password: "",
		});
	};

	const handleAccountFieldChange = (event) => {
		const { name, value } = event.target;
		setAccountData((prev) => ({ ...prev, [name]: value }));
		if (createError) {
			setCreateError("");
		}
		if (statusMessage) {
			setStatusMessage("");
		}
	};

	const handleCreateAccount = async (event) => {
		event.preventDefault();
		const cleanName = accountData.name.trim();
		const cleanEmail = accountData.email.trim().toLowerCase();
		const cleanPassword = accountData.password;

		if (accountData.password !== accountData.confirmPassword) {
			setCreateError("Password and confirm password must match.");
			return;
		}

		if (!cleanName || !cleanEmail || !cleanPassword) {
			setCreateError("Name, email and password are required.");
			return;
		}

		try {
			await postAuth("/api/auth/signup", {
				name: cleanName,
				email: cleanEmail,
				password: cleanPassword,
			});
		} catch (signupError) {
			setCreateError(signupError.message || "Failed to create account.");
			return;
		}

		setFormData({
			email: cleanEmail,
			password: cleanPassword,
		});
		setAccountData({ name: "", email: "", password: "", confirmPassword: "" });
		setStatusMessage("Account created. You can now log in.");
		setMode("login");
	};

	const handleForgotFieldChange = (event) => {
		const { name, value } = event.target;
		setForgotData((prev) => ({ ...prev, [name]: value }));
		if (forgotError) {
			setForgotError("");
		}
		if (statusMessage) {
			setStatusMessage("");
		}
	};

	const handleForgotSubmit = async (event) => {
		event.preventDefault();
		const cleanEmail = forgotData.email.trim().toLowerCase();
		const cleanOtp = forgotData.otp.trim();
		const cleanNewPassword = forgotData.newPassword;

		if (!isOtpSent) {
			setForgotError("Please send OTP first.");
			return;
		}

		if (!/^\d{6}$/.test(cleanOtp)) {
			setForgotError("Please enter the 6-digit OTP sent to your email.");
			return;
		}

		if (forgotData.newPassword !== forgotData.confirmPassword) {
			setForgotError("Password and confirm password must match.");
			return;
		}

		if (!cleanEmail || !cleanNewPassword) {
			setForgotError("Email and new password are required.");
			return;
		}

		try {
			await postAuth("/api/auth/verify-reset-otp", {
				email: cleanEmail,
				otp: cleanOtp,
				newPassword: cleanNewPassword,
			});
		} catch (resetError) {
			setForgotError(resetError.message || "Failed to reset password.");
			return;
		}

		setFormData({
			email: cleanEmail,
			password: cleanNewPassword,
		});
		setForgotData({ email: "", otp: "", newPassword: "", confirmPassword: "" });
		setIsOtpSent(false);
		setMode("login");
		setStatusMessage("Password updated. Please log in with your new password.");
		setSuccessPopup("Password changed successfully.");
		setTimeout(() => {
			setSuccessPopup("");
		}, 2500);
	};

	const handleRequestOtp = async () => {
		const cleanEmail = forgotData.email.trim().toLowerCase();

		if (!cleanEmail) {
			setForgotError("Please enter your email address.");
			return;
		}

		setIsOtpSending(true);
		setForgotError("");
		setStatusMessage("");

		try {
			await postAuth("/api/auth/request-reset-otp", {
				email: cleanEmail,
			});
			setIsOtpSent(true);
			setStatusMessage("OTP sent to your email. Enter OTP and set a new password.");
		} catch (otpError) {
			setIsOtpSent(false);
			setForgotError(otpError.message || "Failed to send OTP.");
		} finally {
			setIsOtpSending(false);
		}
	};

	return (
		<main className="bt-login-page">
			{successPopup && <div className="bt-success-popup">{successPopup}</div>}
			<section className="bt-login-shell" aria-label="Brahmaji Traders login panel">
				<div className="bt-login-brand">
					<p className="bt-kicker">Brahmaji Traders</p>
					<h1>Welcome back</h1>
					<p>
						Track wholesale rates, manage orders, and stay connected with your
						trading network from one dashboard.
					</p>
					<ul>
						<li>Live commodity updates</li>
						<li>Secure order and billing access</li>
						<li>Personalized market alerts</li>
					</ul>
				</div>

				<div className="bt-login-card">
					{mode === "login" && (
						<>
							{(allowAdmin || adminOnly) && !adminOnly && (
								<div className="bt-login-role-switch">
									<button
										type="button"
										className={`bt-role-btn ${loginView === "admin" ? "active" : ""}`}
										onClick={switchToAdminLogin}
									>
										Admin Login
									</button>
									<button
										type="button"
										className={`bt-role-btn ${loginView === "customer" ? "active" : ""}`}
										onClick={switchToCustomerLogin}
									>
										Customer Login
									</button>
								</div>
							)}

							{adminOnly && (
								<div className="bt-login-role-switch">
									<button type="button" className="bt-role-btn active">
										Admin Login
									</button>
								</div>
							)}

							<h2>Sign in</h2>
							<p className="bt-subtitle">
								{adminOnly
									? "Admin login for order control and status management."
									: loginView === "admin"
									? "Admin login for order control and status management."
									: "Customer login for shopping and order tracking."}
							</p>

							<form className="bt-login-form" onSubmit={handleSubmit}>
								<label htmlFor="email">Email address</label>
								<input
									id="email"
									name="email"
									type="email"
									placeholder="Enter email address"
									autoComplete="email"
									value={formData.email}
									onChange={handleFieldChange}
									required
								/>

								<label htmlFor="password">Password</label>
								<div className="bt-password-wrap">
									<input
										id="password"
										name="password"
										type={showPassword ? "text" : "password"}
										placeholder="Enter your password"
										autoComplete="current-password"
										value={formData.password}
										onChange={handleFieldChange}
										required
									/>
									<button
										type="button"
										className="bt-toggle"
										onClick={() => setShowPassword((prev) => !prev)}
										aria-label={showPassword ? "Hide password" : "Show password"}
									>
										{showPassword ? "Hide" : "Show"}
									</button>
								</div>

								{error && <p className="bt-login-error">{error}</p>}

								<div className="bt-login-meta">
									<label className="bt-remember">
										<input type="checkbox" />
										Remember me
									</label>
									{!adminOnly && (
										<button
											type="button"
											className="bt-inline-btn"
											onClick={() => {
												setMode("forgot");
												setForgotError("");
												setIsOtpSent(false);
												setStatusMessage("");
											}}
										>
											Forgot password?
										</button>
									)}
								</div>

								<button type="submit" className="bt-login-btn">
									Login to Dashboard
								</button>
							</form>

							{!adminOnly && (
								<p className="bt-register-line">
									Need an account?{" "}
									<button
										type="button"
										className="bt-inline-btn"
										onClick={() => {
											setMode("create");
											setCreateError("");
											setStatusMessage("");
										}}
									>
										Create new account
									</button>
								</p>
							)}

							{!allowAdmin && !adminOnly && loginView === "customer" && (
								<p className="bt-register-line">
									Admin? <Link to="/admin-login" className="bt-inline-btn">Go to admin login</Link>
								</p>
							)}

							{statusMessage && <p className="bt-login-success">{statusMessage}</p>}
						</>
					)}

					{mode === "create" && !adminOnly && (
						<>
							<h2>Create new account</h2>
							<p className="bt-subtitle">
								Fill your details and save account credentials.
							</p>

							<form className="bt-create-account" onSubmit={handleCreateAccount}>
								<label htmlFor="newName">Full name</label>
								<input
									id="newName"
									name="name"
									type="text"
									placeholder="Enter your full name"
									value={accountData.name}
									onChange={handleAccountFieldChange}
									required
								/>

								<label htmlFor="newEmail">Email address</label>
								<input
									id="newEmail"
									name="email"
									type="email"
									placeholder="name@example.com"
									value={accountData.email}
									onChange={handleAccountFieldChange}
									required
								/>

								<label htmlFor="newPassword">Create password</label>
								<input
									id="newPassword"
									name="password"
									type="password"
									placeholder="Minimum 6 characters"
									value={accountData.password}
									onChange={handleAccountFieldChange}
									required
								/>

								<label htmlFor="confirmPassword">Confirm password</label>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type="password"
									placeholder="Re-enter password"
									value={accountData.confirmPassword}
									onChange={handleAccountFieldChange}
									required
								/>

								{createError && <p className="bt-login-error">{createError}</p>}

								<button type="submit" className="bt-create-btn">
									Save account
								</button>
							</form>

							<p className="bt-register-line">
								Already have an account?{" "}
								<button
									type="button"
									className="bt-inline-btn"
									onClick={() => {
										setMode("login");
										setCreateError("");
									}}
								>
									Back to login
								</button>
							</p>

							{statusMessage && <p className="bt-login-success">{statusMessage}</p>}
						</>
					)}

					{mode === "forgot" && !adminOnly && (
						<>
							<h2>Forgot password</h2>
							<p className="bt-subtitle">
								Enter your email, get OTP, then set a new password.
							</p>

							<form className="bt-create-account" onSubmit={handleForgotSubmit}>
								<label htmlFor="forgotEmail">Registered email</label>
								<div className="bt-forgot-email-row">
									<input
										id="forgotEmail"
										name="email"
										type="email"
										placeholder="name@example.com"
										value={forgotData.email}
										onChange={handleForgotFieldChange}
										required
									/>
									<button
										type="button"
										className="bt-create-btn bt-otp-send-btn"
										onClick={handleRequestOtp}
										disabled={isOtpSending}
									>
										{isOtpSending ? "Sending..." : isOtpSent ? "Resend OTP" : "Send OTP"}
									</button>
								</div>

								{isOtpSent && (
									<>
										<label htmlFor="forgotOtp">OTP</label>
										<input
											id="forgotOtp"
											name="otp"
											type="text"
											inputMode="numeric"
											maxLength={6}
											placeholder="Enter 6-digit OTP"
											value={forgotData.otp}
											onChange={handleForgotFieldChange}
											required
										/>

										<label htmlFor="forgotNewPassword">New password</label>
										<input
											id="forgotNewPassword"
											name="newPassword"
											type="password"
											placeholder="Minimum 6 characters"
											value={forgotData.newPassword}
											onChange={handleForgotFieldChange}
											required
										/>

										<label htmlFor="forgotConfirmPassword">Confirm new password</label>
										<input
											id="forgotConfirmPassword"
											name="confirmPassword"
											type="password"
											placeholder="Re-enter new password"
											value={forgotData.confirmPassword}
											onChange={handleForgotFieldChange}
											required
										/>
									</>
								)}

								{forgotError && <p className="bt-login-error">{forgotError}</p>}

								<button type="submit" className="bt-create-btn">
									Verify OTP & Update password
								</button>
							</form>

							<p className="bt-register-line">
								Remembered password?{" "}
								<button
									type="button"
									className="bt-inline-btn"
									onClick={() => {
										setMode("login");
										setForgotError("");
										setIsOtpSent(false);
										setForgotData({ email: "", otp: "", newPassword: "", confirmPassword: "" });
									}}
								>
									Back to login
								</button>
							</p>

							{statusMessage && <p className="bt-login-success">{statusMessage}</p>}
						</>
					)}
				</div>
			</section>
		</main>
	);
}

export default Login;
