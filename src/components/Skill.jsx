/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */


/**
 * Components
 */
import SkillCard from "./SkillCard";;

const skillItem = [
  {
    imgSrc: '/images/python-5.svg',
    label: 'Python',
    desc: 'Programming Language'
  },
  {
    imgSrc: '/images/java-4.svg',
    label: 'Java',
    desc: 'Programming Language'
  },
  {
    imgSrc: '/images/figma.svg',
    label: 'Figma',
    desc: 'Design tool'
  },
  {
    imgSrc: '/images/css3.svg',
    label: 'CSS',
    desc: 'User Interface'
  },
  {
    imgSrc: '/images/javascript.svg',
    label: 'JavaScript',
    desc: 'Interaction'
  },
  {
    imgSrc: '/images/typescript.svg',
    label: 'TypeScript',
    desc: 'Interaction'
  },
  {
    imgSrc: '/images/vue-9.svg',
    label: 'Vue.js',
    desc: 'Framework'
  },
  {
    imgSrc: '/images/nuxt-2.svg',
    label: 'Nuxt',
    desc: 'Web Framework'
  },
  {
    imgSrc: '/images/firebase-1.svg',
    label: 'Firebase',
    desc: 'Realtime Database'
  },
  {
    imgSrc: '/images/postgresql.svg',
    label: 'PostgreSQL',
    desc: 'Object-Relational Database'
  },
  {
    imgSrc: '/images/mongodb.svg',
    label: 'MongoDB',
    desc: 'Database'
  },
  {
    imgSrc: '/images/spring-boot-1.svg',
    label: 'Spring Boot',
    desc: 'Backend Framework'
  },
  {
    imgSrc: '/images/react.svg',
    label: 'React',
    desc: 'Framework'
  },
  {
    imgSrc: '/images/tailwindcss.svg',
    label: 'TailwindCSS',
    desc: 'Framework'
  },
  {
    imgSrc: '/images/git-bash.svg',
    label: 'Git',
    desc: 'Version Control'
  },
  {
    imgSrc: '/images/numpy-1.svg',
    label: 'Numpy',
    desc: 'Data Processing'
  },
];


const Skill = () => {
  return (
    <section className="section">
      <div className="container">

        <h2 className="headline-2 reveal-up">
          Essential Tools I use
        </h2>

        <p className="text-zinc-400 mt-3 mb-8 max-w-[50ch] reveal-up">
          Discover the powerfull tools and technologies I use to create exceptional, high-performing websites & applications.
        </p>

        <div className="grid gap-3 grid-cols-[repeat(auto-fill,_minmax(250px,_1fr))]">
          {
            skillItem.map(({ imgSrc, label, desc }, key) =>
            (
              <SkillCard
                key={key}
                imgSrc={imgSrc}
                label={label}
                desc={desc}
                classes="reveal-up"
              />
            ))
          }
        </div>

      </div>
    </section>
  ) 
}

export default Skill
