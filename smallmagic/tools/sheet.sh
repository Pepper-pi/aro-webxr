# Tiles four stills of a cast (shots/work/<name>-1..4.png) into one sheet: sh tools/sheet.sh fire frost
cd "$(dirname "$0")/../shots/work" || exit 1
for n in "$@"; do
  ffmpeg -y -loglevel error -i "$n-1.png" -i "$n-2.png" -i "$n-3.png" -i "$n-4.png" -filter_complex "[0][1]hstack[a];[2][3]hstack[b];[a][b]vstack,scale=1920:-1" -q:v 3 "$n-sheet.jpg" && echo "shots/work/$n-sheet.jpg"
done
