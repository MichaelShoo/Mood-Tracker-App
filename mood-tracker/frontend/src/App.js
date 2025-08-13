import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [moods, setMoods] = useState([]);
  const [moodOptions, setMoodOptions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMood, setSelectedMood] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('add'); // 'add', 'history', 'stats'
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMoodOptions();
    fetchMoods();
    fetchStats();
  }, []);

  const fetchMoodOptions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/mood-options`);
      const data = await response.json();
      setMoodOptions(data.moods);
    } catch (error) {
      console.error('Error fetching mood options:', error);
    }
  };

  const fetchMoods = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/moods`);
      const data = await response.json();
      setMoods(data);
    } catch (error) {
      console.error('Error fetching moods:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMood) {
      setMessage('Please select a mood');
      return;
    }

    setLoading(true);
    try {
      const moodData = moodOptions.find(m => m.type === selectedMood);
      const response = await fetch(`${BACKEND_URL}/api/moods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          mood_type: selectedMood,
          emoji: moodData.emoji,
          notes: notes,
        }),
      });

      if (response.ok) {
        setMessage('Mood recorded successfully! 🎉');
        setSelectedMood('');
        setNotes('');
        fetchMoods();
        fetchStats();
      } else {
        const error = await response.json();
        setMessage(error.detail || 'Error recording mood');
      }
    } catch (error) {
      setMessage('Error recording mood');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/moods/export/csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mood_tracker_export.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setMessage('Mood data exported successfully! 📄');
    } catch (error) {
      setMessage('Error exporting data');
      console.error('Error:', error);
    }
  };

  const deleteMood = async (moodId) => {
    if (!window.confirm('Are you sure you want to delete this mood entry?')) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/moods/${moodId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage('Mood entry deleted successfully');
        fetchMoods();
        fetchStats();
      } else {
        setMessage('Error deleting mood entry');
      }
    } catch (error) {
      setMessage('Error deleting mood entry');
      console.error('Error:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderAddMoodView = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          How are you feeling today? 🌟
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-black-700 mb-3">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent date-input-enhanced"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black-700 mb-4">
              Choose Your Mood
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {moodOptions.map((mood) => (
                <button
                  key={mood.type}
                  type="button"
                  onClick={() => setSelectedMood(mood.type)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                    selectedMood === mood.type
                      ? 'border-purple-500 bg-purple-50 shadow-lg'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{mood.emoji}</div>
                  <div className="text-xs font-medium text-gray-600">
                    {mood.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black-700 mb-3">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What made you feel this way today?"
              rows="3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedMood}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
          >
            {loading ? 'Recording...' : 'Record Mood 💝'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderHistoryView = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Mood History 📊</h2>
          <button
            onClick={handleExport}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            Export Data 📄
          </button>
        </div>
        
        {moods.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-gray-500 text-lg">No mood entries yet. Start tracking your mood!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {moods.map((mood) => (
              <div
                key={mood.id}
                className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl">{mood.emoji}</div>
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">
                        {mood.mood_type.replace('_', ' ').split(' ').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ')}
                      </h3>
                      <p className="text-sm text-gray-600">{formatDate(mood.date)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMood(mood.id)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
                {mood.notes && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-100">
                    <p className="text-aqua-700 italic">"{mood.notes}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStatsView = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Mood Statistics 📈
        </h2>
        
        {stats ? (
          <div className="space-y-8">
            <div className="text-center">
              <div className="text-6xl font-bold text-purple-600 mb-2">
                {stats.total_entries}
              </div>
              <p className="text-gray-600 text-lg">Total Mood Entries</p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
                Mood Distribution
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.mood_distribution.map((mood) => (
                  <div
                    key={mood.mood_type}
                    className="stats-card rounded-xl p-6 border border-purple-100"
                  >
                    <div className="text-center">
                      <div className="mood-emoji">{mood.emoji}</div>
                      <h4 className="mood-label">
                        {mood.label}
                      </h4>
                      <div className="text-2xl font-bold text-purple-600">
                        {mood.count}
                      </div>
                      <p className="mood-percentage">
                        {stats.total_entries > 0 
                          ? Math.round((mood.count / stats.total_entries) * 100)
                          : 0}% of entries
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⏳</div>
            <p className="text-gray-500 text-lg">Loading statistics...</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-black-900 mb-4">
            Mood Tracker 🌈
          </h1>
          <p className="text-xl text-gray-1000 max-w-2xl mx-auto">
            Track your daily emotions and discover patterns in your mental well-being
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-2 shadow-lg">
            <nav className="flex space-x-2">
              {[
                { key: 'add', label: 'Add Mood', icon: '➕' },
                { key: 'history', label: 'History', icon: '📊' },
                { key: 'stats', label: 'Statistics', icon: '📈' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setView(tab.key)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    view === tab.key
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-blue-800 font-medium">{message}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {view === 'add' && renderAddMoodView()}
        {view === 'history' && renderHistoryView()}
        {view === 'stats' && renderStatsView()}

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500">
          <p className="text-sm">
            Take care of your mental health - you matter! 💜
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;