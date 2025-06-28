/**
 * @copyright 2025 Jewoo Lee
 * @license <Apache-2 className="0"></Apache-2>
 */

const Hero = () => {
  return (
    <section
      id="home"
      className="pt-28 lg:pt-36"
    >
      <div className="container lg:grid lg:grid-cols-2 items-center lg:gap-10">

        <div>
          <div className="">
            <figure className="">
              <img
                src="/images/avatar-1.jpg"
                width={40}
                height={40}
                alt="Jewoo Lee portrait" 
                className="img-cover"
              />
            </figure>

            <div className="">
              <span className="">
                <span className=""></span>
              </span>

              Available for Work
            </div>
          </div>

          <h2 className="">
            Building Scalable Modern Websites for the Future
          </h2>

          <div className="">
            ButtonPrimary

            ButtonOutline
          </div>
        </div>

        <div className="div">
          <figure className="">
            <img
              src="/images/hero-banner.png"
              width={656}
              height={800}
              alt="Jewoo Lee"
              className="w-full" 
            />
          </figure>
        </div>

      </div>

    </section>
  )
}

export default Hero
