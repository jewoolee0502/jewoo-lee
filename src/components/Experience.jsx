/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */


/**
 * Components
 */

const experiences = [
  {
    title: "Frontend Developer (Independent Contractor)",
    company: "Data-Curve",
    date: "May 2024 – Present",
    description: "Developed AI-resistant interactive components using React, Tailwind CSS, and TypeScript, achieving 20% expansion in front-end data collection. Delivered production-ready code to enhance AI-driven UI generation for language model companies."
  },
  {
    title: "Software Development Intern (Computer Vision)",
    company: "Northking Information",
    date: "Apr 2023 – Aug 2023",
    description: "Enhanced YOLO model performance (+2.5% accuracy, +4% precision) through optimized CNN architectures and filtering loops. Improved license plate recognition systems contributing to revenue growth using Python and OpenCV."
  },
  {
    title: "Python Machine Learning Engineer Intern",
    company: "TaiHe Technology",
    date: "Apr 2022 – Aug 2022",
    description: "Boosted NLP model accuracy by 7% and processing speed by 2% through parameter optimization. Developed financial event classification systems compatible with quantitative trading algorithms using Numpy and Pandas."
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
