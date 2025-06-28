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

        <div className="bg-zinc-800/50 p-7 rounded-2xl md:p-12">
          <p className="text-zinc-300 mb-4 md:mb-8 md:text-xl md:max-w-[60ch]">
            Hi! I&apos;m Jewoo (Jay), a passionate and detail-oriented Computer Engineering student at McGill University with a strong interest 
            in software development, AI, and full-stack web technologies. I thrive on solving real-world problems through code and have experience 
            building dynamic applications using modern frameworks. This website showcases my projects, technical skills, and experiences as I 
            continue growing as a developer and aspiring engineer.
          </p>

          <div className="">
            {
              aboutItems.map(({ label, number}, key) => (
                <div key={key}>
                  <div className="">
                    <span className="">{number}</span>
                    <span className="">+</span>
                  </div>

                  <p className="">{label}</p>
                </div>
              ))
            }

            <img
              src="/images/logo.svg"
              alt="Logo"
              width={30}
              height={30}
              className=""
            />
          </div>
        </div>

      </div>
    </section>
  )
}

export default About
