using System;

namespace eft_where_am_i.Classes
{
    internal static class ResponsiveMapZoom
    {
        // Tarkov Market replaces the desktop map UI at 900 CSS pixels and removes
        // panel_left/panel_right from the DOM. Keep a small buffer above that
        // breakpoint so DPI rounding cannot repeatedly switch layouts.
        internal const double DesktopLayoutTargetWidth = 920.0;
        internal const double MinimumZoomFactor = 0.5;
        internal const double MaximumZoomFactor = 1.0;

        internal static double Calculate(double currentCssWidth, double currentZoomFactor)
        {
            if (!double.IsFinite(currentCssWidth) || currentCssWidth <= 0
                || !double.IsFinite(currentZoomFactor) || currentZoomFactor <= 0)
            {
                return MaximumZoomFactor;
            }

            // Browser zoom changes window.innerWidth inversely. Multiplying the
            // current CSS width by the current zoom reconstructs the width at 100%.
            double widthAtOneHundredPercent = currentCssWidth * currentZoomFactor;
            double layoutSafeZoom = widthAtOneHundredPercent / DesktopLayoutTargetWidth;
            double targetZoom = Math.Min(MaximumZoomFactor, layoutSafeZoom);

            return Math.Round(
                Math.Clamp(targetZoom, MinimumZoomFactor, MaximumZoomFactor),
                3,
                MidpointRounding.AwayFromZero);
        }
    }
}
