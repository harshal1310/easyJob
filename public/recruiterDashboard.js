const postJobButton = document.getElementById('postJobButton');
const jobPopup = document.getElementById('jobPopup');
const closePopupButton = document.getElementById('closePopupButton');
const saveButton = document.getElementById('saveButton');
const updateButton = document.getElementById('updateButton');
const closeShortlistedPopupButton = document.getElementById('closeShortlistedPopupButton');
const shortlistedPopup = document.getElementById('shortlistedPopup');
const skillsInput = document.getElementById('skills');
const skillSuggestions = document.getElementById('skillSuggestions');
const selectedSkillsContainer = document.getElementById('selectedSkills');

let availableSkills = [];
let editingJobId = null;

postJobButton.addEventListener('click', () => openPopup());

closePopupButton.addEventListener('click', () => {
    jobPopup.style.display = 'none';
    editingJobId = null; // Reset the editing job ID
});

closeShortlistedPopupButton.addEventListener('click', () => {
    shortlistedPopup.style.display = 'none';
});

// Fetch available skills for autocomplete
async function fetchSkills() {
    try {
        const response = await fetch('/api/skills');
        const data = await response.json();
        availableSkills = data.skills;
    } catch (error) {
        console.error('Error fetching skills:', error);
    }
}

fetchSkills();

// Handle skill input
skillsInput.addEventListener('input', () => {
    const input = skillsInput.value.toLowerCase();
    if (input.length > 0) {
        const filteredSuggestions = availableSkills.filter(suggestion => suggestion.toLowerCase().startsWith(input));
        if (filteredSuggestions.length > 0) {
            const suggestionItems = filteredSuggestions.map(suggestion => `<div class="suggestion">${suggestion}</div>`).join('');
            skillSuggestions.innerHTML = suggestionItems;
            skillSuggestions.style.display = 'block';
        } else {
            skillSuggestions.innerHTML = '';
            skillSuggestions.style.display = 'none';
        }
    } else {
        skillSuggestions.innerHTML = '';
        skillSuggestions.style.display = 'none';
    }
});

// Handle skill suggestion click
skillSuggestions.addEventListener('click', (event) => {
    if (event.target.classList.contains('suggestion')) {
        const selectedSkill = event.target.textContent;
        const selectedSkillElement = createSkillElement(selectedSkill);
        selectedSkillsContainer.appendChild(selectedSkillElement);
        skillsInput.value = ''; // Clear the input field after selecting a skill
        skillSuggestions.innerHTML = ''; // Clear the suggestions
        skillSuggestions.style.display = 'none';
    }
});

// Function to create a skill element with a remove action
function createSkillElement(skill) {
    const skillElement = document.createElement('div');
    skillElement.classList.add('selected-skill');
    skillElement.textContent = skill.trim();
    skillElement.addEventListener('click', () => {
        skillElement.remove();
    });
    return skillElement;
}

// Save job
saveButton.addEventListener('click', async () => {
    const jobData = {
        job_title: document.getElementById('jobTitle').value,
        location: document.getElementById('location').value,
        experience_min: document.getElementById('experienceMin').value,
        experience_max: document.getElementById('experienceMax').value,
        job_description: document.getElementById('jobDescription').value,
        skills: Array.from(selectedSkillsContainer.children).map(skill => skill.textContent.trim()) // Collect skills from the container
    };

    if (jobData.skills.length === 0) {
        alert("Please select at least one skill!");
        return;
    }

    try {
        const response = await fetch('/post-job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
        });
        const data = await response.json();
        console.log(data);
        jobPopup.style.display = 'none'; // Close the popup after saving
    } catch (error) {
        console.error('Error:', error);
    }
});

// Update job
updateButton.addEventListener('click', async () => {
    const jobData = {
        job_id: editingJobId,
        job_title: document.getElementById('jobTitle').value,
        location: document.getElementById('location').value,
        experience_min: document.getElementById('experienceMin').value,
        experience_max: document.getElementById('experienceMax').value,
        job_description: document.getElementById('jobDescription').value,
        skills: Array.from(selectedSkillsContainer.children).map(skill => skill.textContent.trim()) // Collect skills from the container
    };

    if (jobData.skills.length === 0) {
        alert("Please select at least one skill!");
        return;
    }

    try {
        const response = await fetch('/update-job', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
        });
        const data = await response.json();
        console.log(data);
        jobPopup.style.display = 'none'; // Close the popup after updating
    } catch (error) {
        console.error('Error:', error);
    }
});

// Fetch and display job posts
window.onload = async function () {
    try {
        const response = await fetch('/getPosts');
        const data = await response.json();
        const jobList = document.getElementById('jobList');

        data.forEach(job => {
            const listItem = document.createElement('li');
            listItem.classList.add('job-item');
            listItem.innerHTML = `
                <h3>${job.job_title}</h3>
                <p><strong>Location:</strong> ${job.location}</p>
                <p><strong>Experience:</strong> ${job.experience_min} - ${job.experience_max} years</p>
                <p><strong>Description:</strong> ${job.job_description}</p>
                <p><strong>Skills:</strong> ${job.skills}</p>
                <p><strong>Count Applied:</strong> ${job.total_applied}</p>
                <button class="editButton">Edit</button>
                <button class="deleteButton">Delete</button>
                <button class="shortlistButton" data-jobid="${job.job_id}">Shortlist</button>
            `;
            jobList.appendChild(listItem);

            const editButton = listItem.querySelector('.editButton');
            const deleteButton = listItem.querySelector('.deleteButton');
            const shortlistButton = listItem.querySelector('.shortlistButton');

            editButton.addEventListener('click', () => {
                openPopup(job);
            });

            deleteButton.addEventListener('click', () => {
                if (confirm("Are you sure you want to delete this job?")) {
                    deleteJob(job.job_id, listItem);
                } else {
                    console.log("Deletion canceled");
                }
            });

            shortlistButton.addEventListener('click', async (event) => {
                const jobId = event.target.dataset.jobid;
                shortlistedPopup.style.display = 'flex';
                await fetchShortlistedStudents(jobId, 10);
            });
        });
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};

// Delete job
async function deleteJob(jobId, listItem) {
    try {
        const response = await fetch(`/delete-job/${jobId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            throw new Error('Failed to delete job');
        }
        console.log('Job deleted successfully');
        listItem.remove(); // Remove the job item from the DOM
    } catch (error) {
        console.error('Error deleting job:', error);
    }
}

// Open job popup for editing
function openPopup(jobData) {
    const jobPopup = document.getElementById('jobPopup');
    const saveButton = document.getElementById('saveButton');
    const updateButton = document.getElementById('updateButton');

    if (jobData) {
        document.getElementById('jobTitle').value = jobData.job_title;
        document.getElementById('location').value = jobData.location;
        document.getElementById('experienceMin').value = jobData.experience_min;
        document.getElementById('experienceMax').value = jobData.experience_max;
        document.getElementById('jobDescription').value = jobData.job_description;

        const selectedSkillsContainer = document.getElementById('selectedSkills');
        selectedSkillsContainer.innerHTML = ''; // Clear any previous selected skills
        jobData.skills.split(',').forEach(skill => {
            const selectedSkillElement = createSkillElement(skill);
            selectedSkillsContainer.appendChild(selectedSkillElement);
        });

        saveButton.style.display = 'none';
        updateButton.style.display = 'inline-block';
        editingJobId = jobData.job_id;
    } else {
        document.getElementById('jobTitle').value = '';
        document.getElementById('location').value = '';
        document.getElementById('experienceMin').value = '0';
        document.getElementById('experienceMax').value = '0';
        document.getElementById('jobDescription').value = '';
        selectedSkillsContainer.innerHTML = '';
        saveButton.style.display = 'inline-block';
        updateButton.style.display = 'none';
    }

    jobPopup.style.display = 'flex';
}

// Fetch shortlisted students for a given job ID
async function fetchShortlistedStudents(jobId, limit = 10) {
    try {
    console.log("jobid:",jobId);
        const response = await fetch(`/api/getShortlistedCandidates/${jobId}`);
        const data = await response.json();
        console.log(data)
        const shortlistedList = document.getElementById('shortlistedStudents');
        shortlistedList.innerHTML = ''; // Clear previous list

        if (data && data.length > 0) {
            // Loop through each candidate and add them to the list
            data.forEach(candidate => {
                const listItem = document.createElement('li');
                listItem.classList.add('shortlisted-item');  // Add a class for styling
                
                // Candidate details and action buttons (Shortlist, Remove, Download Resume)
                listItem.innerHTML = `
                    <div class="candidate-card">
                        <div class="candidate-info">
                            <h4>${candidate.full_name} (${candidate.email})</h4>
                            <p>Applied on ${new Date(candidate.submission_time).toLocaleDateString()}</p>
                        </div>
                        <div class="candidate-actions">
                            <button class="shortlist-button" data-candidate-id="${candidate.candidate_id}">Shortlist</button>
                            <button class="remove-button" data-candidate-id="${candidate.candidate_id}">Remove</button>
                            <button class="download-resume-button" data-candidate-id="${candidate.candidate_id}">Download Resume</button>
                        </div>
                    </div>
                `;

                shortlistedList.appendChild(listItem);
            });

            // Add event listeners to Shortlist, Remove, and Download buttons
            const shortlistButtons = document.querySelectorAll('.shortlist-button');
            shortlistButtons.forEach(button => {
                button.addEventListener('click', (event) => handleShortlist(event, jobId));
            });

            const removeButtons = document.querySelectorAll('.remove-button');
            removeButtons.forEach(button => {
                button.addEventListener('click', handleRemove);
            });

            const downloadButtons = document.querySelectorAll('.download-resume-button');
            downloadButtons.forEach(button => {
                button.addEventListener('click', (event) => handleDownloadResume(event, jobId));
            });
        } else {
            const listItem = document.createElement('li');
            listItem.textContent = "No applicants found.";
            shortlistedList.appendChild(listItem);
        }

    } catch (error) {
        console.error('Error fetching shortlisted candidates:', error);
    }
}


async function handleShortlist(event,jobId) {
    const candidateId = event.target.getAttribute('data-candidate-id');

    console.log(`Shortlisting candidate with ID: ${candidateId}`);

    try {
        const response = await fetch(`/api/inviteForInterview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ candidateId, jobId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Candidate with ID ${candidateId} shortlisted successfully!`);
            // Optionally disable the Shortlist button or change its text
            event.target.disabled = true;
            event.target.textContent = 'Shortlisted';
        } else {
            alert(data.message || 'Failed to shortlist candidate');
        }
    } catch (error) {
        console.error('Error shortlisting candidate:', error);
        alert('Error shortlisting candidate');
    }
}

// Handle Remove button click
async function handleRemove(event) {
    const candidateId = event.target.getAttribute('data-candidate-id');
    console.log(`Removing candidate with ID: ${candidateId}`);

    // Remove the candidate from the UI (for now, without sending to the server)
    event.target.closest('li').remove();

    // You can optionally send a request to the server to remove the candidate
   /* try {
        const response = await fetch(`/api/removeCandidate/${candidateId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            alert(`Candidate with ID ${candidateId} removed successfully!`);
        } else {
            alert('Failed to remove candidate');
        }
    } catch (error) {
        console.error('Error removing candidate:', error);
        alert('Error removing candidate');
    }*/
}


async function handleDownloadResume(event,jobId) {
    const candidateId = event.target.getAttribute('data-candidate-id');

    console.log(`Downloading resume for candidate ID: ${candidateId} for job ID: ${jobId}`);

    try {
        // Create the download link directly
        const url = `/resume/${jobId}/${candidateId}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = `resume_candidate_${candidateId}.pdf`; // Optional: Set default filename
        link.click(); // Trigger the download
    } catch (error) {
        console.error('Error downloading resume:', error);
        alert('Error downloading resume');
    }
}



// Close shortlisted popup when clicking outside the content area
shortlistedPopup.addEventListener('click', (event) => {
    if (event.target === shortlistedPopup) {
        shortlistedPopup.style.display = 'none';
    }
});

