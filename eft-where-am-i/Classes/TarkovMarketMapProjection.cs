namespace eft_where_am_i.Classes
{
    internal static class TarkovMarketMapProjection
    {
        private const double TerminalMapRotationDegrees = -75.3;

        private sealed record MapDefinition(
            double Width,
            double Height,
            double Rotation,
            double XOffset,
            double YOffset,
            double Ratio);

        private static readonly Dictionary<string, MapDefinition> Maps = new(StringComparer.OrdinalIgnoreCase)
        {
            ["factory"] = new(3600, 3600, 0, 1800, 1850, 10),
            ["customs"] = new(4400, 3200, 90, 2600, 1600, 2),
            ["interchange"] = new(4000, 3900, 90, 2166, 2004, 2),
            ["woods"] = new(4800, 4800, 90, 2200, 2840, 2),
            ["shoreline"] = new(3700, 3100, 90, 1570, 1450, 1),
            ["reserve"] = new(3200, 3000, 105, 1600, 1520, 2),
            ["lighthouse"] = new(3100, 3700, 90, 1550, 2050, 1),
            ["streets"] = new(3260, 3500, 90, 1660, 1420, 2),
            ["lab"] = new(5500, 4200, 180, 6100, 4050, 10),
            ["ground-zero"] = new(2800, 3100, 90, 1600, 1300, 2),
            ["labyrinth"] = new(3300, 3200, 180, 1485, 1602, 10),
            ["icebreaker"] = new(5000, 8400, 90, 2500, 4200, 25)
        };

        public static bool TryProject(string mapSlug, double worldX, double worldZ, out double left, out double top)
        {
            left = 0;
            top = 0;
            if (string.Equals(mapSlug, "terminal", StringComparison.OrdinalIgnoreCase))
            {
                // Tarkov.dev Terminal interactive map bounds are
                // [[463, -580], [-433, 475]] with a 180-degree CRS rotation.
                // That makes SVG X decrease with EFT world X and SVG Y increase with world Z.
                left = ((463.0 - worldX) / 896.0) * 100.0;
                top = ((worldZ + 580.0) / 1055.0) * 100.0;
                return double.IsFinite(left) && double.IsFinite(top);
            }

            if (string.IsNullOrWhiteSpace(mapSlug) || !Maps.TryGetValue(mapSlug, out MapDefinition? map))
            {
                return false;
            }

            double radians = -map.Rotation * Math.PI / 180.0;
            double gameX = worldZ;
            double gameY = worldX;
            double rotatedX = (gameX * Math.Cos(radians)) - (gameY * Math.Sin(radians));
            double rotatedY = (gameX * Math.Sin(radians)) + (gameY * Math.Cos(radians));
            double mapX = map.XOffset - (rotatedX * map.Ratio);
            double mapY = map.YOffset - (rotatedY * map.Ratio);
            left = (mapX / map.Width) * 100.0;
            top = (mapY / map.Height) * 100.0;
            return double.IsFinite(left) && double.IsFinite(top);
        }

        public static bool TryProjectDirection(
            string mapSlug,
            double worldX,
            double worldZ,
            double quaternionX,
            double quaternionY,
            double quaternionZ,
            double quaternionW,
            out double degrees)
        {
            degrees = 0;
            double forwardX = 2.0 * ((quaternionX * quaternionZ) + (quaternionW * quaternionY));
            double forwardZ = 1.0 - (2.0 * ((quaternionX * quaternionX) + (quaternionY * quaternionY)));
            if (!TryProject(mapSlug, worldX, worldZ, out double startLeft, out double startTop)
                || !TryProject(mapSlug, worldX + forwardX, worldZ + forwardZ, out double endLeft, out double endTop))
            {
                return false;
            }

            double deltaX = endLeft - startLeft;
            double deltaY = endTop - startTop;
            if (Math.Abs(deltaX) < 0.000001 && Math.Abs(deltaY) < 0.000001)
            {
                return false;
            }

            degrees = (Math.Atan2(deltaY, deltaX) * 180.0 / Math.PI) + 90.0;
            if (string.Equals(mapSlug, "terminal", StringComparison.OrdinalIgnoreCase))
            {
                // Terminal's local SVG is displayed in the photographed wall-map orientation.
                // Squad markers live outside the rotated SVG, so their heading needs the same rotation.
                degrees += TerminalMapRotationDegrees;
            }
            return double.IsFinite(degrees);
        }
    }
}
