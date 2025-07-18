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
        className="section"
      >
        <div className="container">
  
          <h2 className="headline-2 mb-8 reveal-up">
            My Career Highlights
          </h2>
  
          {/* <div className="grid gap-x-4 gap-y-5 grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))]">
            {experiences.map(({ title, company, date, description }, key) => (
              <ProjectCard 
                key={key}
                title={title}
                company={company}
                date={date}
                description={description}
                classes="reveal-up"
              />
            ))}
          </div> */}
  
        </div>
      </section>
    )
}

export default Experience
