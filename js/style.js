document.addEventListener("DOMContentLoaded", function () {
	const textButtons = document.querySelectorAll("#text-button");

	if (textButtons.length === 0) {
		return;
	}

	const blinkDuration = 200;
	const blinkIntervals = new WeakMap();
	const baseBorderColor = "#fff";
	const blinkBorderColor = "#ffffff00";
	const baseBackgroundColor = "rgba(0, 0, 0, 0.7)";
	const blinkBackgroundColor = "rgba(0, 0, 0, 0.3)";

	textButtons.forEach(function (button) {
		let isDimmed = false;

		button.addEventListener("mouseenter", function () {
			if (blinkIntervals.has(button)) {
				return;
			}

			const intervalId = setInterval(function () {
				isDimmed = !isDimmed;
				button.style.borderColor = isDimmed ? blinkBorderColor : baseBorderColor;
				button.style.backgroundColor = isDimmed ? blinkBackgroundColor : baseBackgroundColor;
			}, blinkDuration);

			blinkIntervals.set(button, intervalId);
		});

		button.addEventListener("mouseleave", function () {
			const intervalId = blinkIntervals.get(button);
			if (intervalId) {
				clearInterval(intervalId);
				blinkIntervals.delete(button);
			}

			isDimmed = false;
			button.style.borderColor = "";
			button.style.backgroundColor = "";
		});
	});
});
