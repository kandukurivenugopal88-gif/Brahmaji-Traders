import React from "react";
import "./Ad.css";
function Ad() {
  return (
    <div className="ad">
      <div className="mainAd">
        <img
          src="https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/18e48b55150295.597896e27b34d.png"
          alt=""
        />
      </div>
      <div className="subAd1">
        <img
          src="https://static.vecteezy.com/system/resources/previews/027/110/402/non_2x/fashion-model-kids-free-photo.jpg"
          alt=""
        />
      </div>
      <div className="subAd2">
        <img
          src="https://static.vecteezy.com/system/resources/previews/026/911/436/large_2x/fashion-model-kids-free-photo.jpg"
          alt=""
        />
      </div>
    </div>
  );
}

export default Ad;