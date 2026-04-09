import "./Fotter.css";
import "bootstrap-icons/font/bootstrap-icons.css";

function Fotter() {
  const whatsappMessage = encodeURIComponent("Hello Brahmaji Traders, I need support.");

  return (
    <div>
         <footer className="footer">
        <div className="social-icons">
          <a href={`https://wa.me/919866926561?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
            <i className="bi bi-whatsapp" style={{fontSize: '2rem', color: '#25D366'}}></i>
          </a>
          <a href="https://facebook.com/" target="_blank" rel="noopener noreferrer" title="Facebook">
            <i className="bi bi-facebook" style={{fontSize: '2rem', color: '#1877F3'}}></i>
          </a>
          <a href="https://instagram.com/" target="_blank" rel="noopener noreferrer" title="Instagram">
            <i className="bi bi-instagram" style={{fontSize: '2rem', color: '#C13584'}}></i>
          </a>
        </div>
        <div>
          &copy; {new Date().getFullYear()} Brahmaji Traders. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export default Fotter