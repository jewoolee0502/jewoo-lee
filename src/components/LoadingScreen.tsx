/**
 * Loading screen shown while Spline scene loads.
 */

interface LoadingScreenProps {
  loaded: boolean
}

const LoadingScreen = ({ loaded }: LoadingScreenProps) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ${
        loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <p className="text-zinc-400 text-sm tracking-widest uppercase mb-6">
        Loading
      </p>

      <div className="relative w-48 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 bg-sky-400 rounded-full transition-all duration-[2s] ease-out ${
            loaded ? 'w-full' : 'w-2/3'
          }`}
        />
        <div className="absolute inset-y-0 left-0 w-full bg-sky-400/30 rounded-full animate-pulse" />
      </div>
    </div>
  )
}

export default LoadingScreen
