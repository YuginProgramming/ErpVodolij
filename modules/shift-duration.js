const formatDuration = (durationMs) => {
    let seconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    
    return `${hours} год ${minutes} хв ${seconds} с`;
  }
  
  const getShiftDuration = (points) => {
    if (!points || points.length === 0) {
      return 0; // Немає точок, тривалість 0
    }
    // Сортуємо точки за датою створення (на всяк випадок)
    const sortedPoints = points.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const firstTime = new Date(sortedPoints[0].createdAt);
    const lastTime = new Date(sortedPoints[sortedPoints.length - 1].createdAt);
    
    const durationMs = lastTime - firstTime;

    const durationsString = formatDuration(durationMs);
    
    return durationsString;
  }

  export {getShiftDuration}
  