import "./Home.css";
import Ad from "./Ad/Ad.jsx";
import GoogleAd from "../Ads/GoogleAd.jsx";

function Home() {
  return (
    <section className="home-wrap">
      <div className="banner">
        <img src="/image/image.png" alt="brahmaji Traders" />
      </div>
      <div className="home-adsense-slot">
        <GoogleAd slot={import.meta.env.VITE_ADSENSE_HOME_SLOT || ""} />
      </div>
      <Ad />
    </section>
  );
}

export default Home;