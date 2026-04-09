import { useEffect, useState } from "react";
import "./Profile.css";
// import "./FooterProfile.css";
// import "bootstrap-icons/font/bootstrap-icons.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";

function resolveApiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

function Profile({ currentUser }) {
  const [accounts, setAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [chatIssues, setChatIssues] = useState([]);
  const [isLoadingChatIssues, setIsLoadingChatIssues] = useState(false);
  const [chatIssuesError, setChatIssuesError] = useState("");
  const canViewAccounts = ["admin", "developer"].includes(currentUser?.role);

  useEffect(() => {
    if (!canViewAccounts) {
      return;
    }

    const loadAccounts = async () => {
      setIsLoadingAccounts(true);
      setAccountsError("");
      const endpoint = "/api/accounts";
      const headers = {
        "x-user-role": String(currentUser?.role || "").toLowerCase(),
      };

      try {
        const primary = await fetch(resolveApiUrl(endpoint), { headers });
        let data = null;
        try {
          data = await primary.json();
        } catch {
          data = null;
        }

        if (!primary.ok && !API_BASE_URL) {
          const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
          let retryData = null;
          try {
            retryData = await retry.json();
          } catch {
            retryData = null;
          }

          if (!retry.ok || !retryData?.success) {
            throw new Error(retryData?.message || "Unable to load customer accounts.");
          }

          setAccounts(Array.isArray(retryData.accounts) ? retryData.accounts : []);
          return;
        }

        if (!primary.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load customer accounts.");
        }

        setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      } catch (error) {
        setAccountsError(error.message || "Unable to load customer accounts.");
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, [canViewAccounts, currentUser?.role]);

  useEffect(() => {
    if (!canViewAccounts) {
      return;
    }

    const loadChatIssues = async () => {
      setIsLoadingChatIssues(true);
      setChatIssuesError("");
      const endpoint = "/api/chat/issues";
      const headers = {
        "x-user-role": String(currentUser?.role || "").toLowerCase(),
      };

      try {
        const primary = await fetch(resolveApiUrl(endpoint), { headers });
        let data = null;
        try {
          data = await primary.json();
        } catch {
          data = null;
        }

        if (!primary.ok && !API_BASE_URL) {
          const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
          let retryData = null;
          try {
            retryData = await retry.json();
          } catch {
            retryData = null;
          }

          if (!retry.ok || !retryData?.success) {
            throw new Error(retryData?.message || "Unable to load customer AI issues.");
          }

          setChatIssues(Array.isArray(retryData.issues) ? retryData.issues : []);
          return;
        }

        if (!primary.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load customer AI issues.");
        }

        setChatIssues(Array.isArray(data.issues) ? data.issues : []);
      } catch (error) {
        setChatIssuesError(error.message || "Unable to load customer AI issues.");
      } finally {
        setIsLoadingChatIssues(false);
      }
    };

    loadChatIssues();
  }, [canViewAccounts, currentUser?.role]);

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img
          className="profile-image"
          src="/image/image1.png"
          alt="Brahmaji Traders Owner"
        />
        <h1>BRAHMAJI TRADERS</h1>
        <h2>WHOLESALE & RETAIL MERCHANTS</h2>
      </div>
      <div className="profile-details">
        <table>
          <tbody>
            <tr>
              <td><strong>Business Name:</strong></td>
              <td>Brahmaji Traders</td>
            </tr>
            <tr>
              <td><strong>Location:</strong></td>
              <td>Guntur, Andhra Pradesh</td>
            </tr>
            <tr>
              <td><strong>Proprietor:</strong></td>
              <td>Kandukuri Gurubrahmachari</td>
            </tr>
            <tr>
              <td><strong>Email:</strong></td>
              <td>brahmajitraders9@gmail.com</td>
            </tr>
          </tbody>
        </table>
      </div>

      {canViewAccounts && (
        <section className="customer-account-panel">
          <h3>Customer Login Accounts</h3>
          <p className="account-security-note">
            Passwords are protected and cannot be viewed in plain text. Use reset password flow when needed.
          </p>
          {isLoadingAccounts && <p>Loading customer accounts...</p>}
          {!isLoadingAccounts && accountsError && <p>{accountsError}</p>}
          {!isLoadingAccounts && !accountsError && accounts.length === 0 && (
            <p>No customer accounts found yet.</p>
          )}
          {!isLoadingAccounts && !accountsError && accounts.length > 0 && (
            <div className="customer-account-table-wrap">
              <table className="customer-account-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Password (Protected)</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.name || "-"}</td>
                      <td>{account.email || "-"}</td>
                      <td>{account.maskedPassword || "Protected"}</td>
                      <td>{account.updatedAt ? new Date(account.updatedAt).toLocaleString("en-IN") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {canViewAccounts && (
        <section className="customer-account-panel">
          <h3>Customer AI Chat Issues</h3>
          {isLoadingChatIssues && <p>Loading AI issues...</p>}
          {!isLoadingChatIssues && chatIssuesError && <p>{chatIssuesError}</p>}
          {!isLoadingChatIssues && !chatIssuesError && chatIssues.length === 0 && (
            <p>No customer AI issues found yet.</p>
          )}
          {!isLoadingChatIssues && !chatIssuesError && chatIssues.length > 0 && (
            <div className="customer-account-table-wrap">
              <table className="customer-account-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Issue</th>
                    <th>AI Reply</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {chatIssues.map((issue) => (
                    <tr key={issue.id}>
                      <td>{issue.customerEmail || "-"}</td>
                      <td>{issue.issueText || "-"}</td>
                      <td>{issue.botReply || "-"}</td>
                      <td>{issue.createdAt ? new Date(issue.createdAt).toLocaleString("en-IN") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Profile;
