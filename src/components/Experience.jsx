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
    title: "Credit Risk Analyst (Internship)",
    company: "CI Guaranteee",
    date: "Apr 2024 – Jul 2024",
    description: ""
  },
  {
    title: "Sergeant (Marine)",
    company: "Republic of Korea Marine Corps (ROKMC)",
    date: "Sept 2022 – Mar 2024",
    description: ""
  },
  {
    title: "Project Intern",
    company: "Hansan Global",
    date: "Jun 2021 – Sept 2021",
    description: ""
  },
  {
    title: "Summer Intern",
    company: "Korea Trade-Investment Promotion Agency (KOTRA)",
    date: "Jun 2019 – Jul 2019",
    description: ""
  }
];


const Experience = () => {
  return (
      <section
        id="experience"
        className="section py-16 bg-neutral-900 text-white"
      >
        <div className="container mx-auto px-4 max-w-5xl">
  
          <h2 className="headline-2 mb-8 reveal-up">
            My Career Highlights
          </h2>
  
          <div className="relative">
            <div className="absolute left-1/2 top-0 transform -translate-x-1/2 h-full w-1bg-gray-700"></div>

            <div className="flex flex-col space-y-16">
              {experiences.map((exp, index) => (
                <div
                  key={index}
                  className="relative flex flex-col lg:flex-row lg:items-start"
                >
                  {/* Circles */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 bg-white border-4 border-gray-800 w-6 h-6 rounded-full z-10"></div>

                  {/* Left Content */}
                  <div className="lg:w-1/2 lg:pr-12 text-right">
                    <h3 className="text-lg font-semibold">{exp.title}</h3>
                    <p className="text-gray-400 italic">{exp.company}</p>
                    <p className="text-sm text-gray-500 mt-1">{exp.date}</p>
                  </div>

                  {/* Right Content */}
                  <div className="lg:w-1/2 lg:pl-12 mt-6 lg:mt-0">
                    <p className="text-gray-300">{exp.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
  
        </div>
      </section>
    )
}

export default Experience
