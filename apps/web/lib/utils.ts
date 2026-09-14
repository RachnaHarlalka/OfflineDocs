import { createCn } from "cn/config"

// cn never reads globals.css, so ambiguous custom tokens must be declared here:
// `text-ui` reads as a colour and loses its size; `shadow-sh-2` isn't seen as a
// box-shadow and fails to replace a built-in `shadow-md`. Custom colours are fine.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["ui", "caption", "label", "meta", "body", "page-title", "doc-title"],
        },
      ],
      shadow: [{ shadow: ["sh-1", "sh-2", "sh-3"] }],
    },
  },
})
