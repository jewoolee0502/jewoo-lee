/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */


/**
 * Components
 */

const experiences = [
  {
    title: "Full-Stack Developer (Internship)",
    company: "Wholesale Express",
    date: "May 2025 – Present",
    description: ""
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
    description: `As a credit risk analyst at CI Guarantee, I analyze our partnered company’s credit depending on 
    their previous year's performance by examining financial statements, cash flow, and owner’s credit. Depending 
    on the analysis, I then used an internal program to rank them by their credibility to determine how credible 
    our partnered companies are for us to give them loans and insurance for their future projects. I also directly 
    communicated with our partnered companies to resolve their questions and curiosities on their confirmed ranks, 
    and to help them with the application process to receive our credibility test on future possible loans and insurance.`
  },
  {
    title: "Sergeant (Marine)",
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
    description: `HANSAN GLOBAL is a Korean Trading company based in Cairo, Egypt. HANSAN GLOBAL 
    is planning on launching a new business for importing Korean cosmetics into Egypt. Thus, during 
    my internship program, I completed research on the cosmetic market in Egypt. Moreover, I began 
    advertising our products on social media and successfully sold several cosmetic products.`
  },
  {
    title: "Summer Intern",
    company: "Korea Trade-Investment Promotion Agency (KOTRA)",
    date: "Jun 2019 – Jul 2019",
    description: `KOTRA is a trade-investment promotion agency operated by the South Korean Government. 
    During my internship program, I was an overall assistant to my team. Moreover, I also performed 
    customer service for KOTRA as well as giving out presentations. From this experience, I have gained 
    basic knowledge of communication, project managing, and presentation skills.`
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
            return (
              <div
                key={index}
                className={`relative flex flex-col lg:flex-row ${
                  !isEven ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Circle */}
                <div className="absolute left-1/2 transform -translate-x-1/2 bg-neutral-900 border-4 border-sky-400 w-6 h-6 rounded-full z-10 transition-transform group-hover:scale-110"></div>

                {/* Card Container */}
                <div
                  className={`lg:w-1/2 p-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors shadow-lg ${
                    isEven ? "lg:pr-12 text-right" : "lg:pl-12 text-left"
                  }`}
                >
                  <h3 className="text-xl font-semibold mb-1">{exp.title}</h3>
                  <p className="text-sky-400 font-medium">{exp.company}</p>
                  <p className="text-sm text-gray-400 mt-1 uppercase tracking-wide">
                    {exp.date}
                  </p>
                  <p className="text-gray-300 leading-relaxed mt-4 text-left">
                    {exp.description}
                  </p>
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
