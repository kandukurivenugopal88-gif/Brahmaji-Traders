import axios from "axios";

export const data = [
  {
    image:
      "https://cdn.textstudio.com/output/sample/normal/9/2/0/5/all-logo-321-5029.png",
    name: "All",
  },
  {
    image:
      "https://tse4.mm.bing.net/th/id/OIP.EE_ndsO6kcX6VmcLnBW97gHaEJ?rs=1&pid=ImgDetMain&o=7&rm=3",
    name: "Electronics",
  },
  {
    image:
      "https://th.bing.com/th/id/R.daf855d4d8236832c22bac688a028efe?rik=7yuz474wLdPhJQ&riu=http%3a%2f%2fwrightwaybeautysupply.com%2fcdn%2fshop%2fcollections%2fmen_hair_care_1200x1200.jpg%3fv%3d1676256394&ehk=MKO%2b9%2fJcUvJPb%2fX18u8mpVSq%2fRHScC%2b%2bkC%2bg%2ft9nbqU%3d&risl=&pid=ImgRaw&r=0",
    name: "Mens",
  },
  {
    image:
      "https://www.cantechonline.com/wp-content/uploads/group-of-kids-with-cans-Tim-Tam-Tummy.jpeg",
    name: "Womens",
  },
  {
    image:
      "https://www.cantechonline.com/wp-content/uploads/group-of-kids-with-cans-Tim-Tam-Tummy.jpeg",
    name: "Kids",
  },
  {
    image:
      "https://img.staticmb.com/mbcontent/images/crop/uploads/2022/7/What-is-IKEA-Furniture_0_1200.jpg",
    name: "Furniture",
  },
  {
    image:
      "https://static.vecteezy.com/system/resources/previews/028/099/987/large_2x/beauty-cosmetic-makeup-product-brushes-lipstick-nail-polish-collection-on-white-background-generative-ai-free-photo.jpg",
    name: "Cosmetics",
  },
];

export function getProducts(setState) {
  axios
    .get("https://fakestoreapi.com/products")
    .then((res) => {
      setState(res.data);
    })
    .catch((error) => {
      console.log(error);
    });
}