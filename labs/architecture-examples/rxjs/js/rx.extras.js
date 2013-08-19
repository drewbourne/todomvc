// Extras for Reactive Extensions
// Inspired by https://github.com/trxcllnt/rxjs-extras
// 
var observableProto = Rx.Observable.prototype;

// 
// Filters for source values whose fields match the specified value.
// The first argument is the field to match, second argument is the value to match.
// 
// Example:
// 
// 	Rx.Observable
//     .returnValue({ count: 10 })
//     .whereEqualTo('count', 10)
//     .subscribe(function(obj) {
//         console.log(obj.count); // prints 10
//     });
// 
observableProto.whereEqualTo = function(property, value) {
	return this.where(function(item) {
		return item[property] === value;
	});
}

//
// Selects the field from each source value.
//
// Example: 
// 
// 	Rx.Observable
//		.returnValue({ type: 'added', item: { id: 3 } })
//		.selectProperty('item')
//		.subscribe(function(item) {
//			console.log(item.id); // prints 3
//		});
// 
observableProto.selectProperty = function(property) {
	return this.select(function(item) {
		return item[property];
	});
}