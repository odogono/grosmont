import { Site } from '../site';
import { ProcessOptions } from '../types';
import { info, setLocation } from '../reporter';

const Label = '/processor/noop';
const log = (...args) => console.log(`[${Label}]`, ...args);

export async function process(site: Site, options:ProcessOptions = {}) {
    const {reporter } = options;
    setLocation(reporter, Label);

    info(reporter, '');

    return site;
};
