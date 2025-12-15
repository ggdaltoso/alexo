import { Loader } from 'lucide-react';
import { useWeather } from '../frontend/src/hooks/useWeather';
import { CurrentWeather } from './components/CurrentWeather';

function App() {
  const { weather, loading, error } = useWeather();

  return (
    <div className="min-h-screen h-[320px]">
      <div className="h-full p-2">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader className="w-8 h-8 animate-spin text-gray-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-center">
            {error}
          </div>
        ) : weather ? (
          <CurrentWeather data={weather} />
        ) : null}
      </div>
    </div>
  );
}

export default App;
