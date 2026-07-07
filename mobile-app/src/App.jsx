import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Search, Play, Pause, SkipForward, SkipBack, Cast, MoreVertical, PlayCircle, ChevronDown, Volume2, Loader2, ArrowLeft } from 'lucide-react';

const socket = io(`http://${window.location.hostname}:8080`);

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  const [homeSections, setHomeSections] = useState([]);
  const [libraryItems, setLibraryItems] = useState([]);
  
  const [collectionData, setCollectionData] = useState(null);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);

  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isSlidingVolume, setIsSlidingVolume] = useState(false);
  
  const [showQueue, setShowQueue] = useState(false);
  const [playback, setPlayback] = useState({
    title: 'Not Playing',
    artist: '',
    isPlaying: false,
    cover: '',
    currentTime: 0,
    duration: 1,
    volume: 100,
    queue: []
  });

  useEffect(() => {
    socket.on('state-update', (state) => {
      setPlayback(prev => ({ ...prev, ...state }));
      if (state.volume !== undefined && !isSlidingVolume) {
         setVolume(prev => (Math.abs(prev - state.volume) > 2 ? state.volume : prev));
      }
    });

    socket.emit('get-home', (res) => {
      setLoadingHome(false);
      if(res.success) setHomeSections(res.data);
    });

    socket.emit('get-library', (res) => {
      setLoadingLibrary(false);
      if(res.success) setLibraryItems(res.data);
    });

    return () => socket.off('state-update');
  }, [isSlidingVolume]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoadingSearch(true);
    socket.emit('search', query, (res) => {
      setLoadingSearch(false);
      if (res.success) {
        setSearchResults(res.data);
      }
    });
  };

  const handleItemClick = (id) => {
    if(!id) return;
    if(id.startsWith('VL') || id.startsWith('PL') || id.startsWith('RD') || id.startsWith('OL') || id.startsWith('MPRE') || id.startsWith('UC')) {
        setLoadingCollection(true);
        setActiveTab('Collection');
        socket.emit('get-collection', id, (res) => {
           setLoadingCollection(false);
           if(res.success) {
               res.data.id = id;
               setCollectionData(res.data);
           }
        });
    } else {
        if (activeTab === 'Collection' && collectionData && collectionData.id) {
            socket.emit('command', `playVideo:${id}:${collectionData.id}`);
        } else {
            socket.emit('command', `playVideo:${id}`);
        }
    }
  };

  const handleVolumeChange = (e) => {
    const vol = e.target.value;
    setVolume(vol);
    socket.emit('command', `volume:${vol}`);
  };

  const progressPercent = (playback.currentTime / playback.duration) * 100 || 0;

  return (
    <div className="app-wrapper">
      {/* Top Bar */}
      {activeTab !== 'Collection' && (
      <div className="top-bar">
        <div className="logo-area">
          <div className="logo-icon">
            <PlayCircle size={16} color="white" fill="white" />
          </div>
          Music
        </div>
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
          <Cast size={20} color="white" />
          <Search size={20} color="white" onClick={() => setActiveTab('Search')} />
          <div className="profile-pic" onClick={() => {
            setLoadingLibrary(true);
            socket.emit('get-library', (res) => {
              setLoadingLibrary(false);
              if(res.success) setLibraryItems(res.data);
            });
            alert('Library & Login status synced!');
          }}>E</div>
        </div>
      </div>
      )}

      {/* Tabs */}
      {activeTab !== 'Collection' && (
      <div className="tabs">
        {['Home', 'Explore', 'Library', 'Search'].map(tab => (
          <div 
            key={tab} 
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        
        {/* COLLECTION TAB (ALBUMS/PLAYLISTS/ARTISTS) */}
        {activeTab === 'Collection' && (
          <div className="collection-view">
            <div className="collection-header">
              <button className="btn" onClick={() => setActiveTab('Home')} style={{padding: '16px'}}>
                 <ArrowLeft size={28} color="white" />
              </button>
            </div>
            {loadingCollection ? (
               <div style={{textAlign: 'center', marginTop: '4rem', color: '#aaa'}}><Loader2 className="lucide-spin" size={32} /></div>
            ) : collectionData ? (
               <div style={{paddingBottom: '20px'}}>
                  <div className="collection-info">
                     {collectionData.cover && (
                       <img 
                         src={collectionData.cover.replace(/=w\d+-h\d+.*/, '=w600-h600-l90-rj')} 
                         className={`collection-cover ${collectionData.isArtist ? 'artist' : ''}`} 
                         alt="cover"
                       />
                     )}
                     <div className="collection-title">{collectionData.title}</div>
                     {!collectionData.isArtist && (
                       <button className="btn play-btn-large" style={{margin: '16px auto', background: 'white', color: 'black', width: '60px', height: '60px', borderRadius: '50%'}} onClick={() => {
                           if(collectionData.songs[0]) handleItemClick(collectionData.songs[0].id);
                       }}>
                          <Play size={32} fill="black" />
                       </button>
                     )}
                  </div>
                  <div className="collection-songs">
                     {collectionData.songs.length > 0 && <div className="shelf-title">{collectionData.isArtist ? 'Top Songs' : 'Songs'}</div>}
                     {collectionData.songs.map((song, i) => (
                       <div key={i} className="song-item" onClick={() => handleItemClick(song.id)}>
                         {song.cover ? (
                           <img src={song.cover} className="song-thumb" alt="cover" />
                         ) : (
                           <div className="song-thumb" style={{background: '#333'}}></div>
                         )}
                         <div className="song-details">
                           <div className="song-title">{song.title}</div>
                           <div className="song-artist">{song.artist}</div>
                         </div>
                         <MoreVertical size={20} color="#aaa" />
                       </div>
                     ))}
                  </div>
                  
                  {/* Artist Sections (Albums, Singles, etc) */}
                  {collectionData.isArtist && collectionData.sections && collectionData.sections.map((section, idx) => (
                    <div key={idx} style={{marginTop: '24px'}}>
                      <div className="shelf-title" style={{paddingTop: '0'}}>{section.title}</div>
                      <div className="carousel">
                        {section.items.map((item, i) => (
                          <div key={i} className="carousel-item" onClick={() => handleItemClick(item.id)}>
                            <img 
                              src={item.cover?.replace(/=w\d+-h\d+.*/, '=w500-h500-l90-rj')} 
                              className={`carousel-thumb ${item.isArtist ? 'artist' : ''}`} 
                              alt="cover" 
                            />
                            <div className="carousel-title">{item.title}</div>
                            <div className="carousel-subtitle">{item.subtitle}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
            ) : (
               <div style={{textAlign: 'center', marginTop: '2rem'}}>Could not load collection</div>
            )}
          </div>
        )}

        {/* HOME TAB */}
        {activeTab === 'Home' && (
          <div>
            <div className="chips-container">
              {['Energize', 'Workout', 'Relax', 'Commute', 'Focus'].map(chip => (
                <div key={chip} className="chip">{chip}</div>
              ))}
            </div>
            
            {loadingHome ? (
               <div style={{textAlign: 'center', marginTop: '2rem', color: '#aaa'}}><Loader2 className="lucide-spin" size={24} /></div>
            ) : (
              homeSections.map((section, idx) => (
                <div key={idx}>
                  <div className="shelf-title">{section.title}</div>
                  <div className="carousel">
                    {section.items.map((item, i) => (
                      <div key={i} className="carousel-item" onClick={() => handleItemClick(item.id)}>
                        <img 
                          src={item.cover?.replace(/=w\d+-h\d+.*/, '=w500-h500-l90-rj')} 
                          className={`carousel-thumb ${item.isArtist ? 'artist' : ''}`} 
                          alt="cover" 
                        />
                        <div className="carousel-title">{item.title}</div>
                        <div className="carousel-subtitle">{item.subtitle}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'Library' && (
          <div style={{paddingTop: '16px'}}>
            {loadingLibrary ? (
               <div style={{textAlign: 'center', marginTop: '2rem', color: '#aaa'}}><Loader2 className="lucide-spin" size={24} /></div>
            ) : libraryItems.length > 0 ? (
              libraryItems.map((item, idx) => (
                <div key={idx} className="song-item" onClick={() => handleItemClick(item.id)}>
                  <img src={item.cover} className="song-thumb" alt="cover" />
                  <div className="song-details">
                    <div className="song-title">{item.title}</div>
                    <div className="song-artist">{item.subtitle}</div>
                  </div>
                  <MoreVertical size={20} color="#aaa" />
                </div>
              ))
            ) : (
              <div style={{textAlign: 'center', marginTop: '2rem', color: '#aaa', padding: '0 20px'}}>
                Your library is empty.<br/><br/>
                If you have playlists, make sure you are logged in on the PC app, then click the "E" profile icon above to sync.
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
        {activeTab === 'Search' && (
          <div style={{paddingTop: '16px'}}>
            <div className="search-container">
              <form className="search-input-wrapper" onSubmit={handleSearch}>
                <Search size={20} color="#aaa" />
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search songs, albums, artists" 
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
              </form>
            </div>

            {loadingSearch ? (
              <div style={{textAlign: 'center', marginTop: '2rem', color: '#aaa'}}><Loader2 className="lucide-spin" size={24} /></div>
            ) : (
              <div>
                {searchResults.length > 0 && <div className="shelf-title">Top Results</div>}
                {searchResults.map((song, i) => (
                  <div key={i} className="song-item" onClick={() => handleItemClick(song.id)}>
                    {song.cover ? (
                      <img src={song.cover} className="song-thumb" alt="cover" />
                    ) : (
                      <div className="song-thumb" style={{background: '#333'}}></div>
                    )}
                    <div className="song-details">
                      <div className="song-title">{song.title}</div>
                      <div className="song-artist">{song.artist}</div>
                    </div>
                    <MoreVertical size={20} color="#aaa" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXPLORE TAB */}
        {activeTab === 'Explore' && (
          <div style={{textAlign: 'center', marginTop: '4rem', color: '#666', padding: '0 20px'}}>
            <div style={{fontSize: '18px', fontWeight: '500', marginBottom: '8px', color: '#fff'}}>
              Explore New Music
            </div>
            <div>Discover trending tracks and new releases.</div>
          </div>
        )}

      </div>

      {/* Bottom Player */}
      {!isPlayerExpanded && (
        <div className="bottom-player" onClick={() => setIsPlayerExpanded(true)}>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          
          {playback.cover ? (
            <img src={playback.cover} className="player-thumb" alt="cover" />
          ) : (
            <div className="player-thumb" style={{background: '#333'}}></div>
          )}
          
          <div className="player-info">
            <div className="player-title">{playback.title}</div>
            <div className="player-artist">{playback.artist}</div>
          </div>
          
          <div className="player-controls" onClick={e => e.stopPropagation()}>
            <button className="btn play-btn" onClick={() => socket.emit('command', 'playPause')}>
              {playback.isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
            </button>
            <button className="btn" onClick={() => socket.emit('command', 'next')}>
              <SkipForward size={24} fill="white" />
            </button>
          </div>
        </div>
      )}

      {/* Full Screen Player Modal */}
      {isPlayerExpanded && (
        <div className="full-player">
          <div className="full-player-header">
            <button className="btn" onClick={() => { setIsPlayerExpanded(false); setShowQueue(false); }}>
              <ChevronDown size={32} color="white"/>
            </button>
            <div className="full-player-now-playing" style={{display:'flex', gap:'16px'}}>
               <span onClick={() => setShowQueue(false)} style={{color: !showQueue ? 'white' : '#aaa', cursor:'pointer'}}>SONG</span>
               <span onClick={() => setShowQueue(true)} style={{color: showQueue ? 'white' : '#aaa', cursor:'pointer'}}>UP NEXT</span>
            </div>
            <MoreVertical size={24} color="white" />
          </div>
          
          {!showQueue ? (
            <>
              <div className="full-player-cover-container">
                {playback.cover ? (
                  <img src={playback.cover.replace(/=w\d+-h\d+.*/, '=w1000-h1000-p-l90-rj')} alt="cover" className="full-player-cover" />
                ) : (
                  <div className="full-player-cover" style={{background: '#333'}}></div>
                )}
              </div>
              
              <div className="full-player-info-section">
                <div className="full-player-title">{playback.title}</div>
                <div className="full-player-artist">{playback.artist}</div>
              </div>
            </>
          ) : (
            <div className="full-player-queue" style={{flex: 1, overflowY: 'auto', marginBottom: '24px'}}>
               {playback.queue?.map((item, idx) => (
                  <div key={idx} className="song-item" style={{background: item.isPlaying ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px', marginBottom: '4px'}}>
                     <div className="song-details">
                       <div className="song-title" style={{color: item.isPlaying ? '#fff' : '#ccc'}}>{item.title}</div>
                       <div className="song-artist">{item.artist}</div>
                     </div>
                     {item.isPlaying && <Play size={20} color="white" />}
                  </div>
               ))}
               {(!playback.queue || playback.queue.length === 0) && (
                 <div style={{textAlign:'center', color:'#aaa', marginTop:'2rem'}}>Queue is empty.<br/><br/>If you are playing a list, ensure the PC's side menu is open for the queue to load.</div>
               )}
            </div>
          )}
          
          <div className="full-player-progress">
             <div className="progress-bar-container-full">
               <div className="progress-bar-fill-full" style={{ width: `${progressPercent}%` }}></div>
             </div>
          </div>
          
          <div className="full-player-controls">
            <button className="btn" onClick={() => socket.emit('command', 'previous')}><SkipBack size={40} fill="white"/></button>
            <button className="btn play-btn-large" onClick={() => socket.emit('command', 'playPause')}>
              {playback.isPlaying ? <Pause size={48} fill="black" /> : <Play size={48} fill="black" />}
            </button>
            <button className="btn" onClick={() => socket.emit('command', 'next')}><SkipForward size={40} fill="white"/></button>
          </div>
          
          <div className="full-player-volume">
            <Volume2 size={24} color="#aaa" />
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volume} 
              onMouseDown={() => setIsSlidingVolume(true)}
              onMouseUp={() => setIsSlidingVolume(false)}
              onTouchStart={() => setIsSlidingVolume(true)}
              onTouchEnd={() => setIsSlidingVolume(false)}
              onChange={handleVolumeChange} 
              className="volume-slider" 
            />
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .lucide-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
