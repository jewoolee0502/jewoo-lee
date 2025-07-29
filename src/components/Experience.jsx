/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */


/**
 * Components
 */

const experiences = [
  {
    title: "Full-Stack Developer (Internship) NEED UPDATE",
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
    title: "Credit Risk Analyst (Internship) NEED UPDATE",
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
    title: "Summer Intern NEED UPDATE",
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
