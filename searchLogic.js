
function stringDiff(a, b){
    let sameCount = 0
    let longer,shorter;
  
    if(a.length >= b.length){
      longer = a.toLowerCase();
      shorter = b.toLowerCase();
    }
    else if(a.length < b.length){
      longer = b.toLowerCase();
      shorter = a.toLowerCase();
    }
  
    for(var j=0; j<shorter.length; j++){
      if(shorter[j] === longer[j]){
        sameCount ++;
      }
    }
  
    var diff = longer.length - sameCount;
    return diff;
  
  }



module.exports = {

    

    getTitleDiffIndex: function titleDiff(titleA, titleB){
        const aSplit = titleA.split(" ");
        const bSplit = titleB.split(" ");
      
        let longer = [];
      
        aSplit.length >= bSplit.length ? longer=aSplit : longer=bSplit;
      
        
        const allObj = [];
      
        let similarityIndex = 0;
      
        aSplit.forEach((word) => {
          bSplit.forEach((compWord) => {
            if(stringDiff(word,compWord) === 0 ){
              similarityIndex += 15;
            }
            else if(stringDiff(word,compWord) === 1){
                similarityIndex += 10;
            }
            else if(stringDiff(word,compWord) >= 2 && stringDiff(word,compWord)<=3 ){
              similarityIndex += 5;
            }
          })
        })
      
      
        return similarityIndex/longer.length;
      
      }
      

}  
 
