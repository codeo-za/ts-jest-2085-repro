export function hasFlag(args: string[], ...parameters: string[]) {
    const
        matches = args.filter(a => parameters.indexOf(a) > -1),
        result = matches.length;
    matches.forEach(match => {
       const idx = args.indexOf(match);
       args.splice(idx, 1);
    });
    return result;
}

export function popArgs(args: string[], ...parameters: string[]): string[] {
    let inParameter = false;
    const result = [];
    const remainder = args.reduce(
        (acc, cur) => {
            if (inParameter) {
                result.push(cur);
                inParameter = false;
            } else if (parameters.indexOf(cur) > -1) {
                inParameter = true;
            } else {
                acc.push(cur);
            }
            return acc;
        }, []);
    args.splice(0, args.length, ...remainder);
    return result;
}

