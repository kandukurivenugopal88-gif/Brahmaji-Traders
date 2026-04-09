import React, { useContext } from 'react'
import D from "./D";
import Mycontext from "./Mycontext";
function C() {
    const data = useContext(Mycontext);
  return (
    <div>
        <h1>C Component</h1>
        <p>{data ? `User: ${data}` : "User: -"}</p>
        <br />
        <hr />
        <br />
        <D/>
    </div>
  );
}

export default C;