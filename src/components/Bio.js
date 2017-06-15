import React from "react"

// Import typefaces
import "typeface-montserrat"
import "typeface-merriweather"
import "typeface-clear-sans"

import profilePic from "./profile-pic.jpg"
import { rhythm } from "../utils/typography"

class Bio extends React.Component {
  render() {
    return (
      <p
        style={{
          marginBottom: rhythm(2.5),
        }}
      >
        <img
          src={profilePic}
          alt={`Alex Veenendaal`}
          style={{
            float: "left",
            marginRight: rhythm(1 / 4),
            marginBottom: 0,
            width: rhythm(2),
            height: rhythm(2),
          }}
        />
        Written by
        {" "}
        <strong>Alex Veenendaal</strong>
        {" "}
        who lives and works in Devon building useful things.
      </p>
    )
  }
}

export default Bio
