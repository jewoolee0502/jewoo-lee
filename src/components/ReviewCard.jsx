/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import PropTypes from 'prop-types'


const ratings = new Array(5);
ratings.fill({
  icon: 'star',
  style: { fontvariationSettings: '"FILL" 1'}
});

console.log(ratings);

const ReviewCard = ({
  content,
  imgSrc,
  name,
  company
}) => {
  return (
    <div className="">

      <div className="">
        {ratings.map(({ icon, style }, key) => (
          <span
            key={key}
            className="material-symbols-rounded"
            style={style}
          >
            {icon}
          </span>
        ))}
      </div>

      <p className="">
        {content}
      </p>

      <div className="">
        <figure className="">
          <img
            src={imgSrc}  
            alt={name}
            width={44}
            height={44}
            loading='lazy'
            className="img-cover"
          />
        </figure>

        <div>
          <p>{name}</p>

          <p className="">
            {company}
          </p>
        </div>
      </div>

    </div>
  )
}

ReviewCard.propTypes = {
  content: PropTypes.string.isRequired,
  imgSrc: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  company: PropTypes.string.isRequired
}

export default ReviewCard
