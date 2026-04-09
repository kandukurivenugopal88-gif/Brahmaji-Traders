import { useRef, useState } from "react";
import B from "./B";
import Mycontext from "./Mycontext";
function A() {
    const [state,setState]=useState();
    const inputref=useRef();

    const getInputData =()=>{
        setState(inputref.current.value);
    };
  return (
    <div className="map">
        <h1>A Component</h1>
        <br />
        <input ref={inputref} type="text" placeholder="username" />
        <button onClick={getInputData}>Submit</button>
        <br />
        <br />
        <br />
        <br />
        <br />
        <Mycontext value={state}>
        <B />   
        </Mycontext>
    </div>
  );
}

export default A;