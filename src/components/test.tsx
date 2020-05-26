import React, { useState } from 'react';
import {abbrev} from "abbrev";




export const Test = () => {
    const [input, setInput] = useState('');

    const msg = Object.keys(abbrev('Fuck'))[2];

    return (
        <div>
            <p>Do you agree to the statement: {msg}</p>
            <input value={input} onChange={e => setInput((e.target as HTMLTextAreaElement).value)} />
        </div>
    )
}