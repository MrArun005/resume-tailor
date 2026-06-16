import type { ResumeContent } from "@/lib/content";

// Name contains angle brackets to exercise HTML escaping.
export const SAMPLE: ResumeContent = {
  name: "Arun <Test> Mallikarjun",
  headline: "Senior Engineer",
  contact: ["arun@example.com", "Bangalore"],
  sections: [
    {
      title: "Experience",
      blocks: [
        {
          heading: "Senior Engineer — Acme",
          subheading: "2021–Present",
          text: "",
          bullets: ["Cut latency 40%", "Owned billing services"],
        },
      ],
    },
    {
      title: "Skills",
      blocks: [{ heading: "", subheading: "", text: "Node.js, React, AWS", bullets: [] }],
    },
  ],
};
