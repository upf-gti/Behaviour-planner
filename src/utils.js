var UTILS = {

    arrayToString: function(array)
    {
        var str = "";
        for(var i = 0; i < array.length; i++)
            str += String.fromCharCode(array[i]);
        return str;
    },

    rand : function() {
      return Math.random().toString(36).substr(2); // remove `0.`
    },
    
    getFileExtension(filename) {

        var tkn = filename.split(".");
        return tkn[tkn.length - 1].toLowerCase();
    }
}
