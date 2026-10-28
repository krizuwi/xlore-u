export function SchoolCoordinateHelp() {
  return <div className="school-coordinate-help">
    <strong>How to get coordinates from Google Maps</strong>
    <p>Coordinates are optional. Enter both values or leave both blank. After approval, you can add or update them from your school page using Edit profile.</p>
    <ol>
      <li>Open Google Maps and find your campus.</li>
      <li>On a computer, right-click the exact campus location, then click the coordinate pair at the top of the menu to copy it.</li>
      <li>The first number is latitude; the second is longitude. Paste each number into its matching field.</li>
    </ol>
    <p>On a phone, touch and hold an unlabeled spot to drop a pin, then open the pin details to find its coordinates.</p>
    <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Open Google Maps</a>{' · '}
    <a href="https://support.google.com/maps/answer/18539?hl=en" target="_blank" rel="noreferrer">Google Maps coordinate guide</a>
  </div>;
}
