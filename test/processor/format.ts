import { suite } from 'uvu';
import assert from 'uvu/assert';


import { formatDate, FormatDateType } from '../../src/builder/util';

const test = suite('/util/format');
const log = (...args) => console.log(`[/test${test.name}]`, ...args);


test('format date range', async ({es, site, options}) => {

    let com:any = {
        date_start: "2016-05-01T00:00:00.000Z",
        date_end: "2020-12-30T00:00:00.000Z"
    };

    assert.equal( formatDate( com ), 'May 2016 - Dec 2020' );

    com = {
        date_start: '2021-04-02'
    }

    assert.equal( formatDate( com ), 'Apr 2021 -' );


    com = {
        date_start: "2016-05-01T00:00:00.000Z",
        date_end: "2016-12-30T00:00:00.000Z"
    };

    assert.equal( formatDate( com ), 'May - Dec 2016' );

    com = {
        date: '2021-09-05T00:00:00.000Z'
    }

    assert.equal( formatDate( com ), 'Sep 2021' );

    assert.equal( formatDate( com, FormatDateType.DayMonthYear ), '5 September, 2021' );


    com = {
        date_start: '2021'
    };

    assert.equal( formatDate(com), '2021 -' );
    
    com = {
        date_start: '2021',
        date_end: '2021'
    };

    assert.equal( formatDate(com), '2021' );

    com = {
        date_start: '2009-01-01T00:00:00.000Z',
        date_end: '2009-01-01T00:00:00.000Z'
    }

    assert.equal( formatDate(com), '2009' );

    com = {
        date_start: '1998-01-01T00:00:00.000Z',
        date_end: '1999-01-01T00:00:00.000Z'
    };

    assert.equal( formatDate(com), '1998 - 1999' );
    
    com = {
        date_start: '1998-01-01T00:00:00.000Z',
        date_end: '9999-01-01T00:00:00.000Z'
    };

    assert.equal( formatDate(com), '1998 -' );
});


test('format to date', () => {
    let com:any = {
        date: '2021-05-14T13:18:00.000Z'
    }

    assert.equal( formatDate(com, FormatDateType.Date), '2021-05-14' );

    com = {
        date_start: '1998-01-01T00:00:00.000Z',
        date_end: '9999-01-01T00:00:00.000Z'
    };

    assert.equal( formatDate(com, FormatDateType.Date), '1998-01-01' );
    
    com = {
        date_start: '2009-01-01T00:00:00.000Z',
        date_end: '2009-01-01T00:00:00.000Z'
    };

    assert.equal( formatDate(com, FormatDateType.Date), '2009-01-01' );
    
    com = {
        date_start: "2016-05-01T00:00:00.000Z",
        date_end: "2016-12-30T00:00:00.000Z"
    };

    assert.equal( formatDate(com, FormatDateType.Date), '2016-12-30' );

});


test.run();