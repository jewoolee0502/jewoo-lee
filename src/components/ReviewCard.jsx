/**
 * @copyright 2025 Jewoo Lee
 * @license Apache-2.0
 */

import PropTypes from 'prop-types'


const ReviewCard = ({
  content,
  imgSrc,
  name,
  company
}) => {
  return (
    <div className="">

      <div className="">
        {}
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
