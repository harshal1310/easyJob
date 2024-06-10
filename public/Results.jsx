import React from 'react';

const Results = ({ results, searchTerm }) => {
  return (
    <div>
      {/* Display search results here */}
      {results.length > 0 ? (
        results.filter((photo) => photo.toLowerCase().includes(searchTerm.toLowerCase())) // Filter based on search term
          .map((photo) => (
            <img key={photo} src={photo} alt="Search Result" style={{ width: '200px', height: '200px', margin: '10px' }} /> // Display image with styling
          ))
      ) : (
        <p>No results found.</p>
      )}
    </div>
  );
};

export default Results;
