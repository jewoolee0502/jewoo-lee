/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import { useState, useRef, useEffect } from "react";


/**
 * Components
 */

const experiences = [
  {
    title: "Full-Stack Developer (Internship)",
    company: "Wholesale Express",
    date: "May 2025 – August 2025",
    description: `As a Full-Stack Developer Intern at Wholesale Express Canada, I contributed to the development and improvement of a 
    large-scale vehicle auction platform that enables car dealerships to seamlessly buy and sell vehicles. My responsibilities included 
    launching new features, fixing bugs, and enhancing both frontend and backend functionality to improve the overall user experience. 
    On the backend, I used Firebase Realtime Database to ensure instant updates to vehicle listings, and GraphQL to manage structured 
    data related to vehicles and users. On the frontend, I utilized Vue.js and Nuxt to build clean, responsive, and user-friendly interfaces. 
    The team worked in Agile two-week sprints, where we iteratively shipped updates and improvements to the platform. \n\n

    One of the features I contributed to was a public vehicle information page that allows subscribed users to share key vehicle data 
    with non-members via a secure email link. While this was a valuable technical experience, the most meaningful challenge I overcame was 
    adapting to a fully remote team environment. Initially, it was difficult to establish rapport and navigate workflows without face-to-face 
    interaction. However, by proactively scheduling meetings, taking initiative to communicate with designers, developers, and product leads, 
    and seeking continuous feedback, I successfully integrated into the team. This experience significantly strengthened my remote collaboration, 
    cross-functional communication, and independent problem-solving skills, while reinforcing my ability to quickly adapt to unfamiliar 
    environments and contribute meaningfully to a fast-moving development team.`
  },
  {
    title: "Full-Stack Developer (Part-time)",
    company: "Container Foam",
    date: "Mar 2025 – May 2025",
    description: `As a Part‑Time Full‑Stack Developer at Container Foam, I contributed to the development of Cocktail App, 
    a personalized drink recommendation platform that suggests recipes based on users’ moods, flavor preferences, allergies, 
    and available ingredients. I designed and implemented a robust PostgreSQL database schema, ensuring a scalable and 
    maintainable backend architecture capable of supporting future growth. I integrated Google Document AI to extract and 
    structure recipe data from various cocktail books, and leveraged the OpenRouter DeepSeek AI model to generate and recommend 
    tailored cocktail recipes in real time. Despite the project’s two‑month scope, I successfully delivered all assigned tasks, 
    establishing a solid technical foundation and scalable infrastructure that positioned the platform for seamless future development.`
  },
  {
    title: "Credit Risk Analyst (Internship)",
    company: "CI Guaranteee",
    date: "Apr 2024 – Jul 2024",
    description: `As a Credit Risk Analyst Intern at CI Guarantee, I evaluated the financial credibility of partner companies by 
    analyzing annual financial statements, cash flow reports, and ownership credit data. Using an internal credit assessment platform, 
    I translated these insights into quantitative risk scores to support loan and insurance decisions for large-scale development 
    projects. I also served as a point of contact for clients, resolving inquiries regarding their rankings and guiding them through 
    the application process for future credit evaluations. This role strengthened my analytical and financial reasoning skills, 
    while also sharpening my professional communication, client-facing, and problem-solving abilities. Through this experience, I 
    gained a deeper understanding of risk modeling and learned how to present complex financial data clearly and effectively to both 
    technical and non-technical stakeholders.`
  },
  {
    title: "Sergeant",
    company: "Republic of Korea Marine Corps (ROKMC)",
    date: "Sept 2022 – Mar 2024",
    description: `During my service in the Republic of Korea Marine Corps, I advanced through the ranks from Private First Class 
    to Sergeant while serving as a Communication and Intelligence Marine. I worked closely with my unit and fellow Marines, 
    developing strong teamwork and communication skills as we pushed through multiple rigorous and high‑intensity training 
    exercises. In joint operations—including FreedomShield ’23, FreedomShield ’24, and Ssang Yong ’23—I facilitated critical 
    communication between the U.S. Marine Corps (USMC) and the ROKMC by providing both linguistic and cultural interpretation, 
    ensuring seamless coordination in demanding environments. These experiences also enhanced my leadership, collaboration, and problem‑solving 
    abilities under extreme pressure, while further sharpening my capacity to adapt quickly, communicate effectively across language and 
    cultural barriers, and collaborate with diverse teams to achieve mission objectives. Beyond technical and operational growth, my time 
    in the ROKMC instilled a powerful mindset that I carry with me in every challenge: nothing is impossible when you work together as a team.`
  },
  {
    title: "Project Intern",
    company: "Hansan Global",
    date: "Jun 2021 – Sept 2021",
    description: `As a Project Intern at Hansan Global, a Korean trading company based in Cairo, Egypt, I supported the company’s initiative 
    to launch a new Korean cosmetics import business in the Egyptian market. I conducted in-depth market research to evaluate consumer demand, 
    competitor positioning, and potential distribution channels. In addition, I developed and executed a targeted social media marketing 
    strategy, which led to the successful sale of several cosmetic products during the pilot phase. To further support business expansion, I 
    visited and engaged directly with multiple CEOs and cosmetic retail companies to initiate potential partnerships—strengthening both my 
    professional communication and cross-cultural negotiation skills. This experience significantly enhanced my market analysis, digital marketing, 
    and business development capabilities, while also helping me grow as a confident communicator and proactive leader. Working in an international 
    setting taught me how to adapt quickly, take initiative, and build meaningful relationships in unfamiliar and dynamic environments.`
  },
  {
    title: "Summer Intern",
    company: "Korea Trade-Investment Promotion Agency (KOTRA)",
    date: "Jun 2019 – Jul 2019",
    description: `As a Summer Intern at KOTRA (Korea Trade-Investment Promotion Agency), a government-led organization supporting global trade and 
    investment, I provided operational and presentation support for projects promoting Korean businesses abroad. I collaborated closely with team 
    members on day-to-day coordination tasks, assisted in event and project logistics, delivered client-facing presentations, and handled customer 
    inquiries with professionalism and cultural sensitivity. This early exposure to an international, mission-driven organization gave me a strong 
    foundation in cross-cultural communication, project coordination, and public speaking. More importantly, it shaped my ability to adapt quickly, 
    collaborate within a fast-paced professional team, and communicate clearly with diverse stakeholders. This experience, combined with my broader 
    background across technical and leadership roles, has helped me develop a well-rounded and globally aware mindset—one that I’m confident will 
    contribute positively to any team I join.`
  }
];


const Experience = () => {
  return (
    <section
      id="experience"
      className="py-20 bg-neutral-900 text-white"
    >
      <div className="container mx-auto px-4 max-w-6xl relative">
        {/* Title */}
        <h2 className="text-4xl font-bold mb-20">
          My Career Highlights
        </h2>

        {/* Vertical Line */}
        <div className="absolute left-1/2 top-15 transform -translate-x-1/2 w-[2px] h-full bg-gray-700"></div>

        <div className="flex flex-col space-y-20 relative">
          {experiences.map((exp, index) => {
            const isEven = index % 2 === 0;
            const [expanded, setExpanded] = useState(false);
            const [isOverflowing, setIsOverflowing] = useState(false);
            const descriptionRef = useRef(null);

            useEffect(() => {
              if (descriptionRef.current) {
                const lineHeight = parseFloat(getComputedStyle(descriptionRef.current).lineHeight);
                const height = descriptionRef.current.scrollHeight;
                const lines = height / lineHeight;
                if (lines > 5) setIsOverflowing(true);
              }
            }, []);

            return (
              <div
                key={index}
                className={`relative flex flex-col lg:flex-row ${!isEven ? "lg:flex-row-reverse" : ""}`}
              >
                {/* Timeline Circle */}
                <div className="absolute left-1/2 transform -translate-x-1/2 bg-neutral-900 border-4 border-sky-400 w-6 h-6 rounded-full z-10"></div>

                {/* Clickable Card */}
                <div
                  onClick={() => setExpanded(!expanded)}
                  className={`cursor-pointer lg:w-1/2 p-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors shadow-lg ${
                    isEven ? "lg:pr-12 text-right" : "lg:pl-12 text-left"
                  }`}
                >
                  <h3 className="text-xl font-semibold mb-1">{exp.title}</h3>
                  <p className="text-sky-400 font-medium">{exp.company}</p>
                  <p className="text-sm text-gray-400 mt-1 uppercase tracking-wide">{exp.date}</p>

                  {/* Description */}
                  <div
                    ref={descriptionRef}
                    className={`mt-4 text-gray-300 leading-relaxed text-left transition-all duration-300 ease-in-out ${
                      !expanded ? "max-h-[7.5rem] overflow-hidden" : ""
                    }`}
                    style={{
                      maskImage: !expanded && isOverflowing
                        ? "linear-gradient(to bottom, black 60%, transparent 100%)"
                        : "none"
                    }}
                  >
                    {exp.description.split('\n\n').map((para, i) => (
                      <p key={i} className="mb-4">{para.trim()}</p>
                    ))}
                  </div>

                  {/* Show More/Show Less Label (non-clickable) */}
                  {isOverflowing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent card toggle
                        setExpanded(!expanded);
                      }}
                      className="mt-2 text-sky-400 text-sm font-medium hover:underline focus:outline-none"
                    >
                      {expanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Experience;
