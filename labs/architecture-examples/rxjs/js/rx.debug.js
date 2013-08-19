//
// Taps into an Observable, outputting the values to console.log()
// 
// Example: 
// 
// 	Rx.Observable
//		.returnValue({ item: { id: 5 } })
//		.debug('example')
//		.subscribe(function() {
//			// ...	
//		});
// 
Rx.Observable.prototype.debug = function(label) {
	return this.doAction(function() {
		console.log(label || '', arguments);
	});
}