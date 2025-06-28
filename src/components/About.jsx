/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */


const aboutItems = [
  {
    label: 'Project done',
    number: 45
  },
  {
    label: 'Years of experience',
    number: 10
  }
];

const About = () => {
  return (
    <section
      id="about"    
      className="section"
    >
      <div className="container">

        <div className="">
          <p className="">
            Hi! I&apos;m Jewoo (Jay), a passionate and detail-oriented Computer Engineering student at McGill University with a strong interest 
            in software development, AI, and full-stack web technologies. I thrive on solving real-world problems through code and have experience 
            building dynamic applications using modern frameworks. This website showcases my projects, technical skills, and experiences as I 
            continue growing as a developer and aspiring engineer.
          </p>
        </div>

      </div>
    </section>
  )
}

export default About
