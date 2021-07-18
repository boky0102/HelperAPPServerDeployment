function filterJobsByTitle(jobs,title){

    const filteredJobs = [];

   

    jobs.forEach((job) => {
        

        const titleDiffIndx = titleDiff.getTitleDiffIndex(job.title, title);
        
        if(titleDiffIndx > 1){
            const jobWthIndx = {
                username: job.username,
                budget: job.budget,
                title: job.title,
                description: job.description,
                imgSrc: job.imgSrc,
                id: job.id,
                diffIndx: titleDiffIndx
            };
            
            filteredJobs.push(jobWthIndx);
        }

    const returnArray = filteredJobs.sort((a,b) => (a.diffIndx > b.diffIndx ? 1 : -1));
    

    return returnArray;
        
    })

}