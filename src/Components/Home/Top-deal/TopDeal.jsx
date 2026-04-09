import React from "react";
import "./TopDeal.css";
import Card from "./card/Card";
function TopDeal({ adHeading }) {
  return (
    <div className="top-deal">
      <h1>{adHeading}</h1>
      <div className="card-container">
        <Card
          image={
            "https://images-eu.ssl-images-amazon.com/images/G/31/IMG15/Irfan/GATEWAY/MSO/Appliances-QC-PC-372x232----B08RDL6H79._SY232_CB667322346_.jpg"
          }
          title={"From 30000"}
        />
        <Card
          image={
            "https://images-eu.ssl-images-amazon.com/images/G/31/IMG15/Irfan/GATEWAY/MSO/B08345R1ZW---372x232._SY232_CB667322346_.jpg"
          }
          title={"Starts at 15000"}
        />
        <Card
          image={
            "https://images-eu.ssl-images-amazon.com/images/G/31/IMG15/Irfan/GATEWAY/MSO/Appliances-QC-PC-186x116--B08CPQVLZT._SY232_CB667322346_.jpg"
          }
          title={"Upto 30% off"}
        />
        <Card
          image={
            "https://m.media-amazon.com/images/I/61oauTKAuOL._AC_SY400_.jpg"
          }
          title={"Offer Price 9000"}
        />
        <Card
          image={
            "https://m.media-amazon.com/images/I/716SsLu2GWL._AC_SY400_.jpg"
          }
          title={"Upto 70% off"}
        />
      </div>
    </div>
  );
}

export default TopDeal;