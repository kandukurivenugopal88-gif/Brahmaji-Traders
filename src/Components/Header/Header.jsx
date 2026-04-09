import "./Header.css";

function Header() {
  return (
    <div className="header">
        <div className="flexContainer">
            <h1>Dude's - Mart</h1>
        </div>

        <div className="flexContainer">
            <a href="">Home</a>
            <a href="">Products</a>
            <a href="">Profile</a>
            <a href="">Contactus</a>
        </div>

        <div className="flexContainer">
        <i class="bi bi-heart-fill"></i>
        <i class="bi bi-cart-check-fill"></i>
        <button>Logout</button>
        </div>
    </div>
  );
}

export default Header;