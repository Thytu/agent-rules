const styles = /\.(css|scss|sass)$/;
const images = /\.(avif|gif|ico|jpe?g|png|svg|webp)$/;

export async function load(url, context, nextLoad) {
	const { pathname } = new URL(url);
	if (styles.test(pathname))
		return {
			format: "module",
			source: "export default {};",
			shortCircuit: true,
		};
	if (images.test(pathname))
		return {
			format: "module",
			source: `export default ${JSON.stringify({ src: pathname, width: 1, height: 1 })};`,
			shortCircuit: true,
		};
	return nextLoad(url, context);
}
