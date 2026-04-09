import React from "react";
import "./Profile.css";
function Profile() {
  return (
    <div>
      <div class="bgImage">
        <img
          id="whatsapp"
          src="https://cdn-icons-png.flaticon.com/512/4494/4494495.png"
          width="50"
          height="50"
          alt=""
        />

        <img
          src="https://i.pinimg.com/originals/07/44/76/074476f844838fb2487a9d7b4d08a904.jpg"
          id="profileImage"
          width="200"
          height="200"
          alt=""
        />

        <div class="user-details">
          <h1>Rohan Verma</h1>
          <h4>Fullstack Engineer</h4>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Cumque cum
            quidem praesentium iste aut dolores! Praesentium officia rerum magni
            quia est explicabo veritatis numquam illo a maiores pariatur,
            consectetur corrupti fuga laboriosam, accusantium rem quod ipsam
            distinctio nisi ut perferendis natus reprehenderit! Consectetur
            recusandae inventore nam voluptate impedit dolores amet aut harum,
            accusantium omnis quibusdam at? Illum quia nulla quod asperiores,
            blanditiis veniam sed, voluptas consequatur nam possimus itaque sunt
            aperiam nesciunt porro consequuntur, doloribus sit magnam fugit
            commodi placeat! Ea at laborum amet voluptatum veritatis officiis
            impedit pariatur. Dolorum doloremque veniam quidem distinctio velit
            perferendis alias explicabo cumque eos cupiditate debitis nisi.
          </p>
        </div>

        <div class="social-icons">
          <img
            src="https://cdn0.iconfinder.com/data/icons/popular-social-media-colored/48/JD-21-512.png"
            width="100"
            height="100"
            alt=""
          />
          <img
            src="https://img.freepik.com/premium-vector/vector-new-twitter-logo-x-icon-black-background_982187-291.jpg"
            width="80"
            height="80"
            alt=""
          />
          <img
            src="https://i.etsystatic.com/52896651/r/il/c89d2f/6146585509/il_1080xN.6146585509_pa5i.jpg"
            width="100"
            height="100"
            alt=""
          />
        </div>
      </div>
    </div>
  );
}

export default Profile;