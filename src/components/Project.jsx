/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

/**
 * Components
 */
import ProjectCard from "./ProjectCard";

const projects = [
  {
    imgSrc: '/images/MenuLens.png',
    title: 'Menu Lens',
    tags: ['API', 'OCR', 'AI Prompting', 'Prompt Engineering', 'Python'],
    projectLink: 'https://devpost.com/software/menulens'
  },
  {
    imgSrc: '/images/MarletNests.png',
    title: 'Marlet Nests',
    tags: ['API', 'Python', 'Realtime Database'],
    projectLink: 'https://devpost.com/software/martlet-s-nest'
  },
  {
    imgSrc: '/images/adStar.png',
    title: 'adStar',
    tags: ['Machine Learning', 'API', 'Data Analysis'],
    projectLink: 'https://devpost.com/software/adstar'
  },
  {
    imgSrc: '/images/HTTP.png',
    title: 'Health and Toning Targeted Program (HTTP)',
    tags: ['SpringBoot', 'SQL', 'React', 'Agile/Scrum'],
    projectLink: 'https://github.com/jewoolee0502/ECSE428_HTTP'
  },
  {
    imgSrc: '/images/Library.png',
    title: 'Library Management System Application',
    tags: ['Java', 'Gradle', 'Vue', 'Web/Android/iOS', 'Agile/Scrum'],
    projectLink: 'https://github.com/jewoolee0502/project-group-04'
  },
];

const Project = () => {
  return (
    <section
      id="project"
      className="section"
    >
      <div className="container">

        <h2 className="headline-2 mb-8 reveal-up">
          My Portfolio Highlights
        </h2>

        <div className="grid gap-x-4 gap-y-5 grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))]">
          {projects.map(({ imgSrc, title, tags, projectLink }, key) => (
            <ProjectCard 
              key={key}
              imgSrc={imgSrc}
              title={title}
              tags={tags}
              projectLink={projectLink}
              classes="reveal-up"
            />
          ))}
        </div>

      </div>
    </section>
  )
}

export default Project
