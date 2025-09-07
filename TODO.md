- fix validation of "Problem 15: Secret Password" somehow it passes with this student code:
num = get_input('num')
code = get_input('code')

if num >= 12 and code == 43:
  print("Welcome to the movie")
else:
  print('access denied')

it also passes with this code:
num = get_input('num')
code = get_input('code')

print('Access denied')