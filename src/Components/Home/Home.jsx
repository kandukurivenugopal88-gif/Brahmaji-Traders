import React from "react";
import "./Home.css";
import Ad from "./Ad/Ad";
import TopDeal from "./Top-deal/TopDeal";
function Home() {
  return (
    <div>
      <div className="banner">
        <img
          src="https://rukminim2.flixcart.com/fk-p-flap/3140/1040/image/47d9438996e437cc.png?q=60"
          alt=""
        />
      </div>

      <Ad />
      <TopDeal adHeading={"Top Deal's for Trending Fashion"} />
      <TopDeal adHeading={"Top Deal's for Trending Fashion"} />
      <TopDeal adHeading={"Top Deal's for Trending Fashion"} />
      <TopDeal adHeading={"Top Deal's for Trending Fashion"} />
      <TopDeal adHeading={"Top Deal's for Trending Fashion"} />
    </div>
  );
}

export default Home;